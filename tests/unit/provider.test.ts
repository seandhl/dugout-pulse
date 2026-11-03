import { describe, expect, it } from "vitest";
import { createProvider, ingest } from "../../src/server/ingest/provider";
import { publishGate, type RightsRegistry } from "../../src/server/ingest/gate";
import type {
  DataSource,
  License,
  IngestBatch,
  DataProvider,
} from "../../src/server/ingest/contracts";
const source: DataSource = {
  sourceId: "mock",
  publicName: "가상 mock",
  mode: "LICENSED_FILE",
  status: "APPROVED",
  allowedUses: ["collect", "store", "transform", "display"],
  validUntil: "2099-01-01T00:00:00Z",
  displayAllowed: true,
  transformAllowed: true,
};
const license: License = {
  ...source,
  licenseId: "license",
  sourceId: "mock",
  mode: source.mode,
  status: "APPROVED",
  evidenceRef: "test-only-evidence",
  reviewRef: "test-only-review",
  attribution: "MOCK ONLY",
  validFrom: "2020-01-01T00:00:00Z",
  allowedSeasons: [2026],
  allowedCompetitions: ["regular"],
  allowedFields: [
    "playerId",
    "displayName",
    "listedRoles",
    "sourceId",
    "sampleSize",
  ],
};
// Remove DataSource-only properties: the registry is strict and rejects extra fields.
const { publicName: _name, ...licenseRecord } = license as License & {
  publicName?: string;
};
void _name;
const batch: IngestBatch = {
  schemaVersion: "1.0.0",
  batchId: "batch",
  sourceId: "mock",
  licenseId: "license",
  mode: "LICENSED_FILE",
  namespace: "licensed",
  season: 2026,
  competition: "regular",
  asOf: "2026-01-01T00:00:00Z",
  importedAt: "2026-01-02T00:00:00Z",
  adapterVersion: "mock-1",
  players: [
    {
      playerId: "p1",
      displayName: "가상 선수",
      listedRoles: ["batter"],
      sourceId: "mock",
      sampleSize: 0,
    },
  ],
};
function registry(
  s: unknown = source,
  l: unknown = licenseRecord,
): RightsRegistry {
  return { source: () => s, license: () => l };
}
describe("provider ingest and separate publication gate", () => {
  it("round trips an authorized mock file without publishing it", async () => {
    const r = registry();
    const provider: DataProvider = createProvider(source, r);
    expect(provider.describeSource()).toEqual(source);
    expect(await provider.listAvailableSeasons()).toEqual([]);
    expect(await ingest(provider, JSON.stringify(batch), r)).toEqual(batch);
    expect(publishGate(batch, r)).toEqual(batch);
  });
  it("blocks missing source/license and uploaded self authorization", async () => {
    for (const r of [
      registry(undefined, null),
      registry(null),
      registry(source, null),
    ]) {
      await expect(
        createProvider(source, r).parseBatch(batch),
      ).rejects.toThrow();
      expect(() => publishGate(batch, r)).toThrow();
    }
    await expect(
      createProvider(source, registry()).parseBatch({
        ...batch,
        license: licenseRecord,
      }),
    ).rejects.toThrow();
  });
  it.each(["source", "license"])(
    "enforces every current %s permission",
    (target) => {
      const mutations = [
        { status: "PENDING" },
        { status: "REVOKED" },
        { validUntil: "2020-01-01T00:00:00Z" },
        { validUntil: "2026-11-03T00:00:00Z" },
        { displayAllowed: false },
        { transformAllowed: false },
        ...["collect", "store", "transform", "display"].map((use) => ({
          allowedUses: source.allowedUses.filter((u) => u !== use),
        })),
      ];
      for (const change of mutations) {
        const r =
          target === "source"
            ? registry({ ...source, ...change })
            : registry(source, { ...licenseRecord, ...change });
        expect(() =>
          publishGate(batch, r, new Date("2026-11-03T00:00:00Z")),
        ).toThrow();
      }
    },
  );
  it("staging does not grant display and revocation is rechecked", async () => {
    let current = { ...licenseRecord, displayAllowed: false };
    const r = { source: () => source, license: () => current };
    const staged = await createProvider(source, r).parseBatch(batch);
    expect(() => publishGate(staged, r)).toThrow();
    current = { ...licenseRecord, displayAllowed: true };
    expect(publishGate(staged, r)).toEqual(batch);
    current = { ...current, status: "REVOKED" };
    expect(() => publishGate(staged, r)).toThrow();
  });
  it("rejects scope, fields, source mismatch, mixed partitions and malformed input", async () => {
    for (const l of [
      { allowedSeasons: [] },
      { allowedCompetitions: [] },
      { allowedFields: [] },
      { evidenceRef: "" },
      { validFrom: "2098-01-01T00:00:00Z" },
      { sourceId: "other" },
    ]) {
      expect(() =>
        publishGate(batch, registry(source, { ...licenseRecord, ...l })),
      ).toThrow();
    }
    const p = createProvider(source, registry());
    for (const input of [
      "{",
      "x".repeat(5 * 1024 * 1024 + 1),
      { ...batch, namespace: "demo" },
      { ...batch, players: [{ ...batch.players[0], sourceId: "other" }] },
      { ...batch, players: [batch.players[0], batch.players[0]] },
    ]) {
      await expect(p.parseBatch(input)).rejects.toThrow();
    }
  });
  it("keeps DEMO explicit and never promotes it to licensed", async () => {
    const r = registry(
      { ...source, mode: "DEMO" },
      { ...licenseRecord, mode: "DEMO" },
    );
    const p = createProvider({ ...source, mode: "DEMO" }, r);
    expect(
      (await p.parseBatch({ ...batch, mode: "DEMO", namespace: "demo" })).mode,
    ).toBe("DEMO");
    await expect(p.parseBatch(batch)).rejects.toThrow();
  });
  it("API always fails not configured without any network operation", async () => {
    const p = createProvider({ ...source, mode: "LICENSED_API" }, registry());
    await expect(p.listAvailableSeasons()).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    await expect(p.parseBatch(batch)).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    await expect(ingest(p, batch, registry())).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(() =>
      publishGate(
        { ...batch, mode: "LICENSED_API" },
        registry({ ...source, mode: "LICENSED_API" }),
      ),
    ).toThrow("not configured");
  });
});

import { createDatabaseRepository } from "../../src/server/repositories/database";
import type { PlayerRepository } from "../../src/server/ports/players";
it("database public adapter denies all operations without publication context", async () => {
  const projector: PlayerRepository = {
    metadata: async () => {
      throw new Error("must not read");
    },
    list: async () => {
      throw new Error("must not read");
    },
    find: async () => {
      throw new Error("must not read");
    },
  };
  const repository = createDatabaseRepository(projector);
  await expect(
    repository.metadata({ season: 2026, competition: "regular" }),
  ).rejects.toMatchObject({ code: "RIGHTS_DENIED" });
  await expect(
    repository.list(
      { season: 2026, competition: "regular", sort: "name_asc", limit: 20 },
      null,
    ),
  ).rejects.toMatchObject({ code: "RIGHTS_DENIED" });
  await expect(
    repository.find("p1", {
      sourceMode: "DEMO",
      demo: true,
      season: 2026,
      competition: "regular",
      asOf: null,
      lastUpdatedAt: null,
      releaseId: null,
    }),
  ).rejects.toMatchObject({ code: "RIGHTS_DENIED" });
});

it("revalidates custom mock providers instead of trusting parseBatch", async () => {
  const mock: DataProvider = {
    describeSource: () => source,
    listAvailableSeasons: async () => [2026],
    parseBatch: async () => structuredClone(batch),
  };
  expect(await ingest(mock, null, registry())).toEqual(batch);
  await expect(
    ingest(mock, null, registry(source, null)),
  ).rejects.toMatchObject({ code: "RIGHTS_DENIED" });
  const wrongSource = {
    ...mock,
    describeSource: () => ({ ...source, sourceId: "other" }),
  };
  await expect(ingest(wrongSource, null, registry())).rejects.toThrow("불일치");
  expect(() =>
    publishGate(
      { ...batch, players: [{ ...batch.players[0], stats: { h: 1 } }] },
      registry(source, {
        ...licenseRecord,
        allowedFields: [...licenseRecord.allowedFields, "stats"],
      }),
    ),
  ).toThrow();
});
