import "server-only";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { assertAdmin } from "./admin";
// Separate from mutable pipeline state. Failure blocks the operation. No credentials/body logged.
export async function audit(
  request: Request,
  action: string,
  batchId?: string,
) {
  const actor = assertAdmin(request).actor;
  const directory = path.join(process.cwd(), ".demo", "audit");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await appendFile(
    path.join(directory, "events.jsonl"),
    JSON.stringify({
      actor,
      action,
      batchId,
      at: new Date().toISOString(),
      ip: null,
      ipReason: "untrusted-forwarding-headers",
    }) + "\n",
    { mode: 0o600 },
  );
}
