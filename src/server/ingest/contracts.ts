import "server-only";
import { z } from "zod";
import { id, playerSchema } from "../../contracts/api";
export const providerMode = z.enum(["DEMO", "LICENSED_FILE", "LICENSED_API"]);
const use = z.enum(["collect", "store", "transform", "display"]);
const rights = z
  .object({
    allowedUses: z.array(use),
    validUntil: z.iso.datetime(),
    displayAllowed: z.boolean(),
    transformAllowed: z.boolean(),
  })
  .strict();
export const sourceSchema = rights
  .extend({
    sourceId: id,
    publicName: z.string().min(1).max(200),
    mode: providerMode,
    status: z.enum(["PENDING", "APPROVED", "REVOKED", "EXPIRED"]),
  })
  .strict();
export const licenseSchema = rights
  .extend({
    licenseId: id,
    sourceId: id,
    mode: providerMode,
    status: z.enum(["PENDING", "APPROVED", "REVOKED", "EXPIRED"]),
    evidenceRef: z.string().min(1),
    reviewRef: z.string().min(1),
    attribution: z.string().min(1),
    validFrom: z.iso.datetime(),
    allowedSeasons: z.array(z.number().int().min(1900)),
    allowedCompetitions: z.array(
      z.enum(["regular", "postseason", "allstar", "exhibition"]),
    ),
    allowedFields: z.array(z.string().min(1)),
  })
  .strict();
export const batchSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    batchId: id,
    sourceId: id,
    licenseId: id,
    mode: providerMode,
    namespace: z.enum(["demo", "licensed"]),
    season: z.number().int().min(1900),
    competition: z.enum(["regular", "postseason", "allstar", "exhibition"]),
    asOf: z.iso.datetime(),
    importedAt: z.iso.datetime(),
    adapterVersion: z.string().min(1),
    players: z.array(playerSchema).max(50_000),
  })
  .strict();
export type ProviderMode = z.infer<typeof providerMode>;
export type DataSource = z.infer<typeof sourceSchema>;
export type License = z.infer<typeof licenseSchema>;
export type IngestBatch = z.infer<typeof batchSchema>;
export type ProviderScope = Pick<IngestBatch, "season" | "competition">;
export interface DataProvider {
  describeSource(): DataSource;
  listAvailableSeasons(): Promise<number[]>;
  fetchGames?(scope: ProviderScope): Promise<unknown>;
  fetchPlayers?(scope: ProviderScope): Promise<unknown>;
  fetchRoster?(scope: ProviderScope): Promise<unknown>;
  parseBatch(input: unknown): Promise<IngestBatch>;
}
