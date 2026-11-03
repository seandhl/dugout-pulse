import { audit } from "./audit";
import "server-only";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  checksum,
  FileError,
  kindSchema,
  MAX_BYTES,
  parseFile,
  type Kind,
  type Context,
} from "./files";
import { pipeline } from "./pipeline";
import { assertAdmin } from "./admin";
const root = path.join(process.cwd(), "fixtures", "ingest");
export async function template(
  kindInput: unknown,
  format: string,
  variant = "example",
) {
  const kind = kindSchema.safeParse(kindInput);
  if (
    !kind.success ||
    (variant === "correction" && kind.data !== "batting_game_logs") ||
    !["csv", "json"].includes(format) ||
    !["example", "errors", "duplicates", "correction"].includes(variant)
  )
    throw new FileError(400, "지원하지 않는 템플릿입니다");
  return readFile(
    path.join(
      root,
      `${kind.data}${variant === "example" ? "" : `-${variant}`}.${format}`,
    ),
  );
}
async function sampleContext(): Promise<Context> {
  const players = parseFile(
    await template("players", "json"),
    "players.json",
  ) as Record<string, string>[];
  const games = parseFile(
    await template("games", "json"),
    "games.json",
  ) as Record<string, string>[];
  return {
    identities: new Map(
      players.map((p) => [p.external_player_id, p.player_id]),
    ),
    games: new Set(games.map((g) => g.game_id)),
    existing: new Map(),
  };
}
export async function boundedBody(request: Request) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
    throw new FileError(413, "5 MiB 한도 초과");
  const reader = request.body?.getReader();
  if (!reader) throw new FileError(400, "파일이 없습니다");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new FileError(413, "5 MiB 한도 초과");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
export async function stage(request: Request) {
  assertAdmin(request); // Must run before consuming any request body.
  const kind = kindSchema.safeParse(request.headers.get("x-ingest-kind"));
  if (!kind.success) throw new FileError(400, "기록 종류를 선택하세요");
  const filename = request.headers.get("x-file-name") ?? "";
  const format = filename.endsWith(".csv") ? "csv" : "json";
  const mime = request.headers.get("content-type")?.split(";")[0];
  if (mime !== (format === "csv" ? "text/csv" : "application/json"))
    throw new FileError(415, "파일 MIME 형식 불일치");
  const bytes = await boundedBody(request);
  const rows = parseFile(bytes, filename);
  // P0 authorization is only for these self-authored samples. BOM is permitted.
  const canonicalBytes = bytes.subarray(
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0,
  );
  const permitted = await Promise.all(
    [
      "example",
      "errors",
      "duplicates",
      ...(kind.data === "batting_game_logs" ? ["correction"] : []),
    ].map((v) => template(kind.data, format, v)),
  );
  if (
    !permitted.some((sample) => checksum(canonicalBytes) === checksum(sample))
  )
    throw new FileError(422, "현재는 다운로드한 DEMO 샘플 파일만 허용합니다");
  await audit(request, "DRY_RUN_REQUESTED");
  const report = await pipeline.stage(
    kind.data as Kind,
    bytes,
    rows,
    await sampleContext(),
  );
  // Staging is private, append-only and has no relationship to the public repository.
  const directory = path.join(process.cwd(), ".demo", "ingest");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(directory, `${report.importBatchId}.json`),
    JSON.stringify(report),
    { flag: "wx", mode: 0o600 },
  );
  const { accepted: _accepted, ...preview } = report;
  void _accepted;
  return preview;
}
export function failure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof FileError
          ? error.message
          : "서버 처리에 실패했습니다. 다시 시도하세요.",
    },
    {
      status: error instanceof FileError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
