import { z } from "zod";
import { scopeQuery } from "./api";
const base = scopeQuery
  .extend({
    competition: z.enum(["regular", "postseason"]).default("regular"),
    role: z.enum(["hitter", "starter", "reliever"]),
    window: z.enum(["3", "5", "10", "20"]).transform(Number).optional(),
  })
  .strict();
const defaults = <
  T extends { role: "hitter" | "starter" | "reliever"; window?: number },
>(
  q: T,
) => ({ ...q, window: q.window ?? (q.role === "starter" ? 5 : 10) });
export const momentumQuery = base.transform(defaults);
export const rankingsQuery = base
  .extend({
    sort: z.enum(["score", "change"]).default("score"),
    page: z
      .string()
      .regex(/^[1-9]\d{0,4}$/)
      .transform(Number)
      .default(1),
    limit: z
      .string()
      .regex(/^[1-9]\d?$/)
      .transform(Number)
      .pipe(z.number().max(20))
      .default(20),
  })
  .strict()
  .transform(defaults);
const snapshot = z
  .object({
    id: z.string(),
    playerId: z.string(),
    role: z.enum(["hitter", "starter", "reliever"]),
    modelVersion: z.string(),
    algorithmVersion: z.string(),
    computedAt: z.iso.datetime(),
    asOf: z.iso.datetime(),
    season: z.number(),
    competition: z.enum(["regular", "postseason"]),
    dataAsOfGameId: z.string().nullable(),
    window: z.number(),
    windowBasis: z.string(),
    rawFeatureSummary: z.unknown(),
    score: z.number().nullable(),
    confidence: z.string().nullable(),
    eligibility: z.object({
      eligible: z.boolean(),
      reason: z.string().nullable(),
    }),
    explanation: z.unknown(),
    deltaScore: z.number().nullable(),
    previousSnapshotId: z.string().nullable(),
    sourceIds: z.array(z.string()),
    inputRefs: z.array(z.string()),
    sampleSize: z.number(),
    demo: z.literal(true),
    publicationRevision: z.number(),
    rankingStatus: z.string(),
    rank: z.number().optional(),
  })
  .strict();
export const momentumResponse = z.object({
  data: z.array(snapshot),
  excluded: z.array(snapshot),
  meta: z.object({
    demo: z.literal(true),
    sourceMode: z.literal("DEMO"),
    revision: z.number(),
    modelVersion: z.string(),
    windowBasis: z.string(),
    recommendedWindow: z.number(),
    season: z.number(),
    competition: z.string(),
    role: z.string(),
    window: z.number(),
    sort: z.string().optional(),
  }),
  pagination: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      excludedTotal: z.number(),
      hasMore: z.boolean(),
    })
    .optional(),
  error: z.null(),
});
