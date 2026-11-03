import { z } from "zod";
export const homeQuery = z
  .object({
    role: z.enum(["batter", "starter", "reliever"]).default("batter"),
    window: z.enum(["3", "5", "10", "20"]).default("10"),
  })
  .strict();
export const homePlayer = z.object({
  playerId: z.string(),
  name: z.string(),
  team: z.string(),
  sourceId: z.string(),
  sampleSize: z.number(),
  lastAppearance: z.string().nullable(),
  score: z.number().nullable(),
  confidence: z.string().nullable(),
  reason: z.string(),
});
export const homeResponse = z.object({
  demo: z.literal(true),
  season: z.number(),
  competition: z.string(),
  asOf: z.string(),
  lastUpdatedAt: z.string(),
  lastGame: z.string().nullable(),
  source: z.string(),
  model: z.string(),
  window: z.number(),
  players: z.array(homePlayer),
});
export type HomeData = z.infer<typeof homeResponse>;
