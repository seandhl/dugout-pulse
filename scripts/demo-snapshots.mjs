// Offline, separate-process job: never invoked by a public request.
import ts from "typescript";
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
export async function prepareSnapshots(fixture, options = {}) {
  const temp = await mkdtemp(join(tmpdir(), "dugout-snapshots-"));
  try {
    for (const name of [
      "src/server/reads/home-projection",
      "src/stats/momentum",
      "src/stats/batting",
      "src/stats/pitching",
    ]) {
      const source = await readFile(`${name}.ts`, "utf8");
      const output = ts
        .transpileModule(source, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        })
        .outputText.replace(/(from\s+["'])(\.[^"']+)(["'])/g, "$1$2.mjs$3");
      const target = join(temp, `${name}.mjs`);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, output);
    }
    const { selectHome } = await import(
      pathToFileURL(join(temp, "src/server/reads/home-projection.mjs"))
    );
    const snapshots = [];
    for (const role of options.roles ?? ["batter", "starter", "reliever"])
      for (const window of options.windows ?? ["3", "5", "10", "20"]) {
        // Idempotent bounded role/window batch. The active release stays untouched on failure.
        for (let attempt = 1; ; attempt++) {
          try {
            const started = performance.now();
            const result = selectHome(fixture, { role, window });
            snapshots.push({
              role,
              window: Number(window),
              payload: JSON.stringify(result),
            });
            console.log(
              `DEMO snapshot ${role}/${window} ${(performance.now() - started).toFixed(1)}ms attempt=${attempt}`,
            );
            break;
          } catch (error) {
            if (attempt >= 3) throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * 2 ** attempt),
            );
          }
        }
        await new Promise((resolve) => setImmediate(resolve));
      }
    return snapshots;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
