import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
const base = process.env.PERFORMANCE_BASE_URL ?? "http://127.0.0.1:3188";
const jobStart = performance.now();
const child = spawn(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    `import {prepareSnapshots} from './scripts/demo-snapshots.mjs'; import {generatePerformance} from './src/demo/performance.ts'; await prepareSnapshots(generatePerformance(), {roles:['batter'],windows:['3']});`,
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let finished = false;
let output = "";
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));
process.on("exit", () => {
  if (!finished) child.kill();
});
const done = new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => {
    finished = true;
    if (code === 0) resolve();
    else reject(Error(output));
  });
});
const samples = [];
// Real HTTP requests overlap an offline batch; pause between requests to span its runtime.
while (!finished) {
  const start = performance.now();
  const response = await fetch(
    `${base}/api/v1/player-directory?q=${encodeURIComponent("가상 A")}`,
  );
  if (!response.ok) {
    child.kill();
    throw Error(`API ${response.status}`);
  }
  await response.arrayBuffer();
  samples.push(performance.now() - start);
  await new Promise((resolve) => setTimeout(resolve, 100));
}
await done;
samples.sort((a, b) => a - b);
const report = {
  measuredAt: new Date().toISOString(),
  mode: "DEMO offline batter/3 batch overlapping HTTP",
  jobWallMs: performance.now() - jobStart,
  samples: samples.length,
  medianMs: samples[Math.floor(samples.length / 2)],
  p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
  maxMs: samples.at(-1),
  jobOutput: output,
};
await writeFile(
  "reports/performance-concurrency.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (samples.length < 10 || report.p95Ms >= 200)
  throw Error("Concurrent HTTP target failed");
