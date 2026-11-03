import { z } from "zod";
import { date } from "../server/ingest/files";
export const boardQuery = z
  .object({
    season: z.coerce.number().int().min(1900).max(9999).default(2026),
    competition: z.enum(["regular", "postseason"]).default("regular"),
    window: z.enum(["3", "5", "10", "20"]).default("10"),
    date: date.optional(),
    team: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,100}$/)
        .optional(),
    ),
    sort: z.enum(["score", "change", "decline"]).default("score"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export type BoardQuery = z.infer<typeof boardQuery>;
