import { afterEach, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  chmodSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each([undefined, "", "   "])(
  "uses a matching local server for base URL %j",
  async (value) => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", value);
    vi.stubEnv("PLAYWRIGHT_PORT", "3199");
    vi.stubEnv("VERIFY_PRODUCTION", "1");
    const { default: config } = await import("../../playwright.config");
    expect(config.use?.baseURL).toBe("http://127.0.0.1:3199");
    expect(config.webServer).toMatchObject({
      url: config.use?.baseURL,
      command: "pnpm db:seed && pnpm start --port 3199",
      reuseExistingServer: false,
    });
  },
);

it("preserves explicit standalone E2E targets without starting a server", async () => {
  vi.stubEnv("PLAYWRIGHT_BASE_URL", " https://example.invalid ");
  const { default: config } = await import("../../playwright.config");
  expect(config.use?.baseURL).toBe("https://example.invalid");
  expect(config.webServer).toBeUndefined();
});

it.each([false, true])(
  "verify owns its server and preserves gates; fail=%s",
  (fail) => {
    const dir = mkdtempSync(join(tmpdir(), "dugout-verify-"));
    try {
      const log = join(dir, "calls.jsonl");
      const executable =
        `#!${process.execPath}\n` +
        `require('node:fs').appendFileSync(process.env.VERIFY_CALL_LOG, JSON.stringify({args:process.argv.slice(2), baseURL:process.env.PLAYWRIGHT_BASE_URL, mode:process.env.DATA_MODE, production:process.env.VERIFY_PRODUCTION, database:process.env.TEST_DATABASE_URL})+'\\n');\n` +
        `if(process.env.VERIFY_FAIL && process.argv.includes('test:e2e')) process.exit(7);\n`;
      for (const name of ["pnpm", "node"]) {
        writeFileSync(join(dir, name), executable);
        chmodSync(join(dir, name), 0o755);
      }
      const result = spawnSync(process.execPath, ["scripts/verify.mjs"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          PLAYWRIGHT_BASE_URL: "https://example.invalid",
          TEST_DATABASE_URL: "disposable-test-marker",
          VERIFY_CALL_LOG: log,
          VERIFY_FAIL: fail ? "1" : "",
        },
      });
      expect(result.status).toBe(fail ? 7 : 0);
      const calls = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(calls.map((call) => call.args)).toEqual([
        ["lint"],
        ["typecheck"],
        ["scripts/test-core.mjs"],
        ["scripts/validate-migrations.mjs"],
        ["build"],
        ["test:e2e"],
        ...(!fail ? [["test:ingest:e2e"]] : []),
      ]);
      for (const call of calls) {
        expect(call).not.toHaveProperty("baseURL");
        expect(call).toMatchObject({
          mode: "DEMO",
          production: "1",
          database: "disposable-test-marker",
        });
      }
      expect(result.stdout.includes("PASS: all verification stages")).toBe(
        !fail,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
