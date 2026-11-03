import "server-only";
import {
  withPublication,
  publicationIdentity,
} from "../repositories/publication";
import { createHash } from "node:crypto";
import { appendFile, mkdir, open } from "node:fs/promises";
import path from "node:path";
import type { AlertAdapter } from "./rules";
const directory = path.join(process.cwd(), ".demo", "observability");
type Event = {
  type: "request" | "job" | "alert";
  at: string;
  durationMs?: number;
  status?: number;
  ok?: boolean;
  code?: string;
  count?: number;
};
// Deliberate allowlist: never serialize Request, Error, body, URL, headers or actor.
export async function log(event: Event) {
  const safe = {
    type: event.type,
    at: event.at,
    durationMs: event.durationMs,
    status: event.status,
    ok: event.ok,
    code: event.code?.replace(/[^A-Z_]/g, "").slice(0, 80),
    count: event.count,
  };
  console.info(JSON.stringify(safe));
  if (process.env.APP_ENV && process.env.APP_ENV !== "local") return;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await appendFile(
      path.join(directory, "events.jsonl"),
      JSON.stringify(safe) + "\n",
      { mode: 0o600 },
    );
  } catch {
    console.error('{"type":"telemetry_write_failed"}');
  }
}
export const structuredLogAdapter: AlertAdapter = {
  emit: (a) =>
    log({
      type: "alert",
      at: new Date().toISOString(),
      code: a.code,
      count: a.count,
    }),
};
export async function observeRequest(
  run: () => Promise<Response> | Response,
  request?: Request,
): Promise<Response> {
  if (request && new URL(request.url).pathname.startsWith("/api/v1/")) {
    return withPublication(
      request.headers.get("x-pulse-release") ??
        new URL(request.url).searchParams.get("releaseId") ??
        undefined,
      async () => {
        const response = await observeRequest(run);
        if (response.ok) {
          const identity = publicationIdentity();
          response.headers.set("X-Pulse-Release", identity.releaseId);
          response.headers.set("X-Pulse-Revision", String(identity.revision));
          response.headers.set("X-Pulse-As-Of", identity.asOf);
          response.headers.set(
            "ETag",
            `"${createHash("sha256")
              .update(await response.clone().text())
              .digest("hex")}"`,
          );
        }
        return response;
      },
    );
  }
  const start = performance.now();
  let status = 500;
  try {
    const response = await run();
    status = response.status;
    return response;
  } finally {
    await log({
      type: "request",
      at: new Date().toISOString(),
      status,
      durationMs: Math.round(performance.now() - start),
    });
  }
}
export async function observeJob<T>(run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  let ok = false;
  try {
    const result = await run();
    ok = true;
    return result;
  } finally {
    await log({
      type: "job",
      at: new Date().toISOString(),
      ok,
      durationMs: Math.round(performance.now() - start),
    });
  }
}
export function requestMetrics(events: Event[], now = Date.now()) {
  const recent = events.filter(
    (e) => Date.parse(e.at) >= now - 3600000 && Date.parse(e.at) <= now,
  );
  const requests = recent.filter((e) => e.type === "request");
  const values = requests
    .map((e) => e.durationMs)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .sort((a, b) => a - b);
  const percentile = (p: number) =>
    values.length ? values[Math.ceil(values.length * p) - 1] : null;
  return {
    windowMinutes: 60,
    sampleSize: requests.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    apiErrorRate: requests.length
      ? requests.filter((e) => (e.status ?? 0) >= 500).length / requests.length
      : null,
    clientErrorRate: requests.length
      ? requests.filter((e) => (e.status ?? 0) >= 400 && (e.status ?? 0) < 500)
          .length / requests.length
      : null,
    scheduledJobFailures: recent.filter((e) => e.type === "job" && !e.ok)
      .length,
  };
}
export async function readMetrics() {
  try {
    const handle = await open(path.join(directory, "events.jsonl"), "r");
    let data: string;
    try {
      const size = (await handle.stat()).size;
      const start = Math.max(0, size - 2 * 1024 * 1024);
      const buffer = Buffer.alloc(size - start);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
      data = buffer.subarray(0, bytesRead).toString("utf8");
      if (start) data = data.slice(data.indexOf("\n") + 1);
    } finally {
      await handle.close();
    }
    return requestMetrics(
      data
        .split("\n")
        .filter(Boolean)
        .slice(-10000)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as Event];
          } catch {
            return [];
          }
        }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return requestMetrics([]);
  }
}
