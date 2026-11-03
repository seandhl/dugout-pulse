import { z } from "zod";

export const comparisonPoint = z.object({
  season: z.number().int(),
  competition: z.enum(["regular", "postseason"]),
  role: z.enum(["hitter", "starter", "reliever"]),
  window: z.number().int().positive(),
  modelVersion: z.string(),
  snapshotId: z.string(),
  asOf: z.string(),
  sourceIds: z.array(z.string()),
  inputRefs: z.array(z.string()),
});
export const comparisonBasis = z.object({
  kind: z.enum(["previous_eligible_publication", "moving_appearance_window"]),
  current: comparisonPoint,
  previous: comparisonPoint.nullable(),
});
export type ComparisonPoint = z.infer<typeof comparisonPoint>;
export type ComparisonBasis = z.infer<typeof comparisonBasis>;
