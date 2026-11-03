import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";
import { consumeBudget, securityHeaders } from "../../src/server/http/security";
import {
  assertAdmin,
  issueSession,
  sessionCookie,
} from "../../src/server/ingest/admin";
import { playersQuery } from "../../src/contracts/api";
import { queryInput, respond } from "../../src/server/http/response";
import { z } from "zod";
afterEach(() => vi.unstubAllEnvs());
it("bounds budgets and resets expired windows", () => {
  expect(consumeBudget("test", 1, 100)).toBe(true);
  expect(consumeBudget("test", 1, 101)).toBe(false);
  expect(consumeBudget("test", 1, 60100)).toBe(true);
});
it("limits public routes without trusting spoofed forwarding headers", () => {
  for (let n = 0; n < 300; n++)
    expect(
      proxy(new NextRequest("https://example.test/api/v1/meta")).status,
    ).toBe(200);
  const result = proxy(
    new NextRequest("https://example.test/api/v1/meta", {
      headers: { "x-forwarded-for": "new-client" },
    }),
  );
  expect(result.status).toBe(429);
  expect(result.headers.get("retry-after")).toBe("60");
});
it("rejects unicode signatures and extra session segments without runtime errors", () => {
  vi.stubEnv("ADMIN_ORIGIN", "https://private.example");
  vi.stubEnv("ADMIN_ACTOR_ID", "review");
  vi.stubEnv("ADMIN_SESSION_SECRET", "x".repeat(64));
  const token = issueSession();
  for (const value of [
    token.split(".")[0] + "." + "é".repeat(64),
    token + ".extra",
  ]) {
    expect(() =>
      assertAdmin(
        new Request("https://private.example/api/admin/operations", {
          headers: { cookie: `${sessionCookie}=${value}` },
        }),
      ),
    ).toThrow("유효하지 않은 세션");
  }
});
it("denies unknown sort/filter, excess page sizes and duplicate query keys", () => {
  for (const query of [
    { sort: "name; DROP TABLE players" },
    { limit: "21" },
    { filter: "anything" },
  ])
    expect(playersQuery.safeParse(query).success).toBe(false);
  expect(() =>
    queryInput(new Request("https://example.test/?season=2026&season=2025")),
  ).toThrow();
});
it("does not disclose exception details", async () => {
  const result = await respond(z.unknown(), async () => {
    throw new Error("private-stack-secret");
  });
  expect(result.status).toBe(500);
  expect(await result.text()).not.toContain("private-stack-secret");
});
it("sets baseline CSP and production-only TLS policy", () => {
  const production = Object.fromEntries(
    securityHeaders(true).map(({ key, value }) => [key, value]),
  );
  expect(production["Content-Security-Policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(production["Content-Security-Policy"]).not.toContain("unsafe-eval");
  expect(production["Strict-Transport-Security"]).toBe("max-age=31536000");
  expect(
    securityHeaders(false).some((h) => h.key === "Strict-Transport-Security"),
  ).toBe(false);
});
it("published endpoint rejects duplicate scope with 400", async () => {
  const { GET } = await import("../../src/app/api/v1/published/route");
  const response = await GET(
    new Request(
      "https://example.test/api/v1/published?season=2026&season=2025",
    ),
  );
  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
