import "server-only";
import { z } from "zod";
import { battingStats } from "../../stats/batting";
import { pitchingStats } from "../../stats/pitching";
import { createHash, randomUUID } from "node:crypto";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 50_000;
export const kindSchema = z.enum([
  "players",
  "games",
  "batting_game_logs",
  "pitching_game_logs",
  "rosters",
]);
export type Kind = z.infer<typeof kindSchema>;
const id = z.string().regex(/^demo_[a-z0-9_]{1,80}$/);
const count = z.preprocess(
  (v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v),
  z.number().int().min(0).max(1000),
);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "유효한 날짜가 아닙니다",
  );
export const kst = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+09:00)?$/)
  .transform((v) => (/Z$|\+09:00$/.test(v) ? v : `${v}+09:00`))
  .refine((v) => {
    if (!Number.isFinite(Date.parse(v))) return false;
    const offset = v.endsWith("Z") ? 0 : 9 * 60 * 60 * 1000;
    return (
      new Date(Date.parse(v) + offset).toISOString().slice(0, 19) ===
      v.slice(0, 19)
    );
  }, "유효한 KST 시각이 아닙니다")
  .transform((v) => new Date(v).toISOString());
const scope = {
  season: z.preprocess(
    (v) => (typeof v === "string" && /^\d{4}$/.test(v) ? Number(v) : v),
    z.number().int().min(1900).max(9999),
  ),
  competition: z.enum(["regular", "postseason", "allstar", "exhibition"]),
  as_of: kst,
};
const identity = { external_player_id: id };
export const schemas = {
  players: z
    .object({
      ...scope,
      ...identity,
      player_id: id,
      display_name: z
        .string()
        .min(1)
        .max(100)
        .regex(/^DEMO /),
      role: z.enum(["BATTER", "STARTER", "RELIEVER", "COACH"]),
      person_type: z.enum(["PLAYER", "COACH"]).default("PLAYER"),
    })
    .strict(),
  games: z
    .object({
      ...scope,
      game_id: id,
      doubleheader_no: z
        .preprocess(
          (v) => (typeof v === "string" ? Number(v) : v),
          z.number().int().min(1).max(2),
        )
        .default(1),
      official_final: z.boolean().default(false),
      resumed: z.boolean().default(false),
      played_on: date,
      scheduled_at_kst: kst,
      home_team_id: id,
      away_team_id: id,
      status: z.enum([
        "SCHEDULED",
        "IN_PROGRESS",
        "SUSPENDED",
        "FINAL",
        "CANCELLED",
        "POSTPONED",
        "VOID",
      ]),
    })
    .strict()
    .refine((v) => v.home_team_id !== v.away_team_id, "홈/원정 팀이 같습니다"),
  batting_game_logs: z
    .object({
      ...scope,
      ...identity,
      game_id: id,
      team_id: id,
      r: count.optional(),
      rbi: count.optional(),
      pa: count,
      ab: count,
      h: count,
      hr: count,
      doubles: count.optional(),
      triples: count.optional(),
      bb: count.optional(),
      hbp: count.optional(),
      sf: count.optional(),
      sac: count.optional(),
      ci: count.optional(),
      so: count.optional(),
    })
    .strict()
    .refine(
      (v) => v.hr <= v.h && v.h <= v.ab && v.ab <= v.pa,
      "HR ≤ H ≤ AB ≤ PA 위반",
    )
    .refine((v) => {
      try {
        battingStats([v]);
        return true;
      } catch {
        return false;
      }
    }, "타격 사건 합계가 일치하지 않습니다"),
  pitching_game_logs: z
    .object({
      ...scope,
      ...identity,
      game_id: id,
      team_id: id,
      role: z.enum(["STARTER", "RELIEVER"]),
      innings: z.string().regex(/^\d{1,2}\.[012]$/, "이닝은 6.0/6.1/6.2 형식"),
      h: count,
      er: count,
      so: count,
      bf: count.optional(),
      bb: count.optional(),
      ibb: count.optional(),
      hbp: count.optional(),
      hr: count.optional(),
      r: count.optional(),
      walk_definition: z.enum(["includes_ibb", "excludes_ibb"]).optional(),
    })
    .strict()
    .transform((v) => ({
      ...v,
      outs:
        Number(v.innings.split(".")[0]) * 3 + Number(v.innings.split(".")[1]),
    }))
    .refine((v) => {
      try {
        pitchingStats([
          {
            counts: { ...v, outsRecorded: v.outs },
            walkDefinition: v.walk_definition ?? "includes_ibb",
          },
        ]);
        return true;
      } catch {
        return false;
      }
    }, "투구 사건 합계가 일치하지 않습니다"),
  rosters: z
    .object({
      ...scope,
      ...identity,
      team_id: id,
      snapshot_on: date,
      valid_until: date.optional(),
      person_type: z.enum(["PLAYER", "COACH"]).default("PLAYER"),
      effective_on: date,
      status: z.enum(["REGISTERED", "UNREGISTERED", "UNKNOWN"]),
    })
    .strict()
    .refine(
      (v) =>
        v.effective_on <= v.snapshot_on &&
        (!v.valid_until || v.valid_until >= v.snapshot_on) &&
        v.snapshot_on <=
          new Date(Date.parse(v.as_of) + 9 * 3600000)
            .toISOString()
            .slice(0, 10),
      "효력일이 스냅샷 이후입니다",
    ),
};
export class FileError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Bounded RFC4180 reader: quoted delimiters/newlines and doubled quotes, no guessing. */
function csv(text: string): Record<string, string>[] {
  const table: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
    if (row.length > 32) throw new FileError(400, "열 한도 초과");
  };
  const pushRow = () => {
    pushCell();
    table.push(row);
    row = [];
    if (table.length > MAX_ROWS + 1) throw new FileError(400, "행 한도 초과");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === ",") pushCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new FileError(400, "CSV 따옴표 오류");
      cell += c;
    }
    if (cell.length > 2048) throw new FileError(400, "셀 길이 한도 초과");
  }
  if (quoted) throw new FileError(400, "CSV 따옴표 미종결");
  if (cell || row.length || closed) pushRow();
  const headers = table.shift();
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new FileError(400, "헤더 누락 또는 중복");
  return table.map((r) => {
    if (r.length !== headers.length)
      throw new FileError(400, "CSV 열 개수 불일치");
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}
const aliases: Record<string, string> = {
  외부선수ID: "external_player_id",
  선수ID: "player_id",
  선수명: "display_name",
  역할: "role",
  시즌: "season",
  대회: "competition",
  기준시각: "as_of",
};
export function parseFile(bytes: Uint8Array, filename: string): unknown[] {
  if (bytes.length > MAX_BYTES) throw new FileError(413, "5 MiB 한도 초과");
  if (!/^[a-zA-Z0-9_-]+\.(csv|json)$/.test(filename))
    throw new FileError(400, "안전한 CSV/JSON 파일명만 허용합니다");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, "");
  } catch {
    throw new FileError(400, "UTF-8 인코딩이 아닙니다");
  }
  if (text.includes("\0"))
    throw new FileError(400, "NUL 문자는 허용하지 않습니다");
  let rows: unknown;
  try {
    rows = filename.endsWith(".csv") ? csv(text) : JSON.parse(text);
  } catch (e) {
    if (e instanceof FileError) throw e;
    throw new FileError(400, "JSON 구문 오류");
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS)
    throw new FileError(400, "1~50,000행 배열이 필요합니다");
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const entries = Object.entries(row).map(
      ([key, value]) => [aliases[key] ?? key, value] as const,
    );
    if (new Set(entries.map(([key]) => key)).size !== entries.length)
      throw new FileError(400, "헤더 매핑 충돌");
    return Object.fromEntries(entries);
  });
}
export type Canonical = Record<string, unknown>;
export type Context = {
  identities: ReadonlyMap<string, string>;
  games: ReadonlySet<string>;
  existing: ReadonlyMap<string, Canonical>;
};
export function rowKey(kind: Kind, row: Canonical) {
  const keys =
    kind === "players"
      ? ["player_id"]
      : kind === "games"
        ? ["game_id"]
        : kind === "rosters"
          ? ["external_player_id", "snapshot_on"]
          : ["game_id", "external_player_id"];
  return JSON.stringify([
    kind,
    row.season,
    row.competition,
    ...keys.map((k) => row[k]),
  ]);
}
export function validateRows(kind: Kind, rows: unknown[], context: Context) {
  const counts = { new: 0, updates: 0, duplicates: 0, errors: 0, warnings: 0 };
  const issues: {
    row: number;
    severity: "error" | "warning";
    code: string;
    fields: string[];
    message?: string;
  }[] = [];
  const accepted: Canonical[] = [];
  const seen = new Map<string, string>();
  const identitySeen = new Map<string, string>();
  const issue = (
    row: number,
    severity: "error" | "warning",
    code: string,
    fields: string[] = [],
    message?: string,
  ) => {
    const details: Record<string, { fields: string[]; message: string }> = {
      FORMULA_CELL: {
        fields: ["row"],
        message: "수식으로 해석될 수 있는 셀을 허용하지 않습니다.",
      },
      IDENTITY_CONFLICT: {
        fields: ["external_player_id", "player_id"],
        message: "외부 선수 ID가 기존의 다른 선수 ID와 연결되어 있습니다.",
      },
      UNMAPPED_PLAYER: {
        fields: ["external_player_id"],
        message: "선수 ID 매핑을 먼저 게시해야 합니다.",
      },
      UNKNOWN_GAME: {
        fields: ["game_id"],
        message: "참조한 경기를 먼저 게시해야 합니다.",
      },
      CONFLICTING_DUPLICATE: {
        fields: ["row"],
        message: "같은 논리 키에 서로 다른 값이 있습니다.",
      },
      OUTLIER_REVIEW: {
        fields: ["row"],
        message: "큰 수치가 포함되어 있습니다. 원본 확인 후 승인하세요.",
      },
    };
    fields = fields.length ? fields : (details[code]?.fields ?? []);
    message ??= details[code]?.message ?? code;
    counts[severity === "error" ? "errors" : "warnings"]++;
    if (issues.length < 200)
      issues.push({ row, severity, code, fields, message });
  };
  rows.forEach((input, index) => {
    const n = index + 1;
    // Reject formula cells rather than retaining dangerous content in exports.
    if (
      input &&
      typeof input === "object" &&
      Object.values(input).some(
        (v) => typeof v === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(v),
      )
    ) {
      issue(n, "error", "FORMULA_CELL");
      return;
    }
    const parsed = schemas[kind].safeParse(input);
    if (!parsed.success) {
      issue(
        n,
        "error",
        "INVALID_ROW",
        parsed.error.issues.map((i) => i.path.join(".")),
        parsed.error.issues.map((i) => i.message).join("; "),
      );
      return;
    }
    const row: Canonical = parsed.data;
    if (kind === "players") {
      const external = String(row.external_player_id),
        internal = String(row.player_id);
      const mapped =
        identitySeen.get(external) ?? context.identities.get(external);
      if (mapped && mapped !== internal) {
        issue(n, "error", "IDENTITY_CONFLICT");
        return;
      }
      identitySeen.set(external, internal);
    } else if (kind !== "games") {
      const mapped = context.identities.get(String(row.external_player_id));
      if (!mapped) {
        issue(n, "error", "UNMAPPED_PLAYER");
        return;
      }
      row.player_id = mapped;
      if (kind !== "rosters" && !context.games.has(String(row.game_id))) {
        issue(n, "error", "UNKNOWN_GAME");
        return;
      }
    }
    const key = rowKey(kind, row),
      value = JSON.stringify(row);
    if (seen.has(key)) {
      if (seen.get(key) === value) counts.duplicates++;
      else issue(n, "error", "CONFLICTING_DUPLICATE");
      return;
    }
    seen.set(key, value);
    if (
      (typeof row.pa === "number" && row.pa > 10) ||
      (typeof row.outs === "number" && row.outs > 36) ||
      ["h", "er", "so"].some((k) => typeof row[k] === "number" && row[k] > 30)
    )
      issue(n, "warning", "OUTLIER_REVIEW");
    const previous = context.existing.get(key);
    if (previous && JSON.stringify(previous) === value) counts.duplicates++;
    else {
      counts[previous ? "updates" : "new"]++;
      accepted.push(row);
    }
  });
  return {
    counts,
    issues,
    issuesTruncated: counts.errors + counts.warnings > issues.length,
    accepted,
  };
}
export function makeReport(
  kind: Kind,
  bytes: Uint8Array,
  rows: unknown[],
  context: Context,
) {
  const result = validateRows(kind, rows, context);
  return {
    importBatchId: randomUUID(),
    checksum: checksum(bytes),
    sourceId: "demo-file-source",
    licenseId: "demo-self-authored-v1",
    schemaVersion: "1.0.0",
    kind,
    mode: "DEMO",
    status: result.counts.errors ? "REJECTED" : "VALIDATED",
    published: false,
    publishAllowed: false,
    importedAt: new Date().toISOString(),
    rowCount: rows.length,
    sampleSize: result.accepted.length,
    ...result,
    counts: {
      ...result.counts,
      deleted:
        kind === "games"
          ? [...context.existing.values()].filter(
              (record) =>
                ("pa" in record || "outs" in record) &&
                result.accepted.some(
                  (game) =>
                    game.game_id === record.game_id &&
                    game.season === record.season &&
                    game.competition === record.competition &&
                    game.status !== "FINAL",
                ),
            ).length
          : 0,
    },
  };
}
