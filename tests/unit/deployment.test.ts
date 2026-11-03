import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";
import { parseEnv } from "../../src/config/env";
import { assertInternal } from "../../src/server/ingest/admin";
afterEach(() => vi.unstubAllEnvs());
it("keeps blank templates usable and rejects unsupported deployment modes", () => {
  expect(parseEnv({ APP_ENV: "", PUBLICATION_STATE: "" }).APP_ENV).toBe(
    "local",
  );
  expect(() => parseEnv({ DATA_MODE: "APPROVED" })).toThrow();
  expect(() => parseEnv({ PUBLICATION_STATE: "unknown" })).toThrow();
});
it("denies hosted admin even with an internal origin", () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("ADMIN_ORIGIN", "https://admin.example.invalid");
  const request = new NextRequest(
    "https://admin.example.invalid/api/admin/ingest/status",
  );
  expect(proxy(request).status).toBe(403);
  expect(() => assertInternal(request)).toThrow("읽기 전용");
});
it("suspends data publication while retaining legal and health access", () => {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("PUBLICATION_STATE", "maintenance");
  for (const path of [
    "/",
    "/players",
    "/api/v1/players",
    "/api/v1/published",
  ]) {
    const response = proxy(new NextRequest(`https://example.invalid${path}`));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  for (const path of [
    "/legal",
    "/privacy",
    "/data-terms",
    "/about",
    "/api/health",
    "/api/ready",
  ]) {
    expect(
      proxy(new NextRequest(`https://example.invalid${path}`)).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1");
  }
});
