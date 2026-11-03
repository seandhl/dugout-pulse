import { spawn } from "node:child_process";
import { once } from "node:events";
const servers = [];
try {
  for (const [port, maintenance] of [
    [3200, false],
    [3201, true],
  ]) {
    const server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          APP_ENV: "staging",
          DATA_MODE: "DEMO",
          PUBLICATION_STATE: maintenance ? "maintenance" : "demo",
        },
      },
    );
    servers.push(server);
    const base = `http://127.0.0.1:${port}`;
    let available = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw Error("production server exited");
      try {
        available = (
          await fetch(`${base}/api/health`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok;
      } catch {
        /* Wait for this server to bind. */
      }
      if (available) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!available) throw Error("production server startup timed out");
    const smoke = spawn(process.execPath, ["scripts/deploy-smoke.mjs"], {
      stdio: "inherit",
      env: {
        ...process.env,
        SMOKE_BASE_URL: base,
        SMOKE_MAINTENANCE: maintenance ? "1" : "0",
      },
    });
    const [code] = await once(smoke, "exit");
    if (code !== 0) throw Error("production smoke failed");
  }
} finally {
  for (const server of servers) {
    if (server.exitCode === null) {
      const closed = once(server, "exit");
      server.kill("SIGTERM");
      await closed;
    }
  }
}
