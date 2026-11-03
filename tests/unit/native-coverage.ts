import { Session } from "node:inspector";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
if (process.env.CORE_COVERAGE === "1") {
  const session = new Session();
  session.connect();
  const post = (method: string) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      session.post(method, (error, result) =>
        error ? reject(error) : resolve(result as Record<string, unknown>),
      );
    });
  await post("Profiler.enable");
  await new Promise<void>((resolve, reject) =>
    session.post(
      "Profiler.startPreciseCoverage",
      { callCount: true, detailed: true },
      (error) => (error ? reject(error) : resolve()),
    ),
  );
  afterAll(async () => {
    const result = await post("Profiler.takePreciseCoverage");
    mkdirSync("coverage/core-raw", { recursive: true });
    writeFileSync(
      `coverage/core-raw/${randomUUID()}.json`,
      JSON.stringify(result),
    );
    await post("Profiler.stopPreciseCoverage");
    session.disconnect();
  });
}
