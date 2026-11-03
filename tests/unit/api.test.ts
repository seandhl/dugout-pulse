import { describe, it, expect, vi } from "vitest";
import { playersQuery, playersResponse } from "../../src/contracts/api";
import { demoRepository } from "../../src/server/repositories/demo";
import { createPlayerService } from "../../src/server/reads/players";
import { respond, input } from "../../src/server/http/response";
import { getDatabase, closeDatabase } from "../../src/server/db/client";
vi.mock("../../src/server/db/demo", async () => {
  const { generate } = await import("../../src/demo/generator");
  return { readDemo: generate };
});
const service = createPlayerService(demoRepository, "test-key");
describe("API contract", () => {
  it("validates scope, sort, limits and rejects unknown SQL fields", () => {
    for (const query of [
      { season: "2026x" },
      { role: "pitcher" },
      { limit: "21" },
      { sort: "DROP TABLE" },
      { sql: "SELECT 1" },
      { season: "1899" },
    ])
      expect(playersQuery.safeParse(query).success).toBe(false);
  });
  it("paginates deterministically and binds signed cursors to filters", async () => {
    const query = playersQuery.parse({ limit: "1" });
    const first = playersResponse.parse(await service.list(query));
    if (first.error) throw new Error();
    const cursor = first.pagination!.nextCursor!;
    const second = await service.list({ ...query, cursor });
    expect(second.data[0].playerId).not.toBe(first.data[0].playerId);
    await expect(
      service.list({ ...query, cursor: cursor + "x" }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    await expect(
      service.list({ ...query, cursor, role: "batter" }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
  });
  it("maps validation and unavailable repository errors without leaks", async () => {
    const bad = await respond(playersResponse, async () =>
      input(playersQuery, { limit: "99" }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("BAD_INPUT");
    const broken = createPlayerService(
      {
        ...demoRepository,
        list: async () => {
          throw new Error("private SQL");
        },
      },
      "key",
    );
    const result = await respond(playersResponse, () =>
      broken.list(playersQuery.parse({})),
    );
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toContain("private SQL");
    await expect(
      service.find("missing", playersQuery.parse({})),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.meta({ season: 2025, competition: "regular" }),
    ).rejects.toMatchObject({ code: "DATA_UNAVAILABLE" });
  });
  it("shares connection initialization and closes once", async () => {
    let connected = 0,
      closed = 0;
    const factory = () => ({
      $connect: async () => {
        connected++;
      },
      $disconnect: async () => {
        closed++;
      },
    });
    const [a, b] = await Promise.all([
      getDatabase(factory),
      getDatabase(factory),
    ]);
    expect(a).toBe(b);
    expect(connected).toBe(1);
    await Promise.all([closeDatabase(), closeDatabase()]);
    expect(closed).toBe(1);
  });
});
