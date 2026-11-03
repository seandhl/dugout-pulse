import { z } from "zod";
export const directoryQuery = z
  .object({
    q: z.string().trim().max(100).default(""),
    season: z.enum(["2026"]).default("2026"),
    team: z
      .string()
      .regex(/^(sample_[0-9])?$/)
      .default(""),
    role: z.enum(["", "hitter", "starter", "reliever"]).default(""),
    membership: z.literal("appeared").default("appeared"),
    window: z.enum(["3", "5", "10", "20"]).default("10"),
    sort: z.enum(["name", "games", "ops", "era", "score"]).default("name"),
    page: z
      .string()
      .regex(/^[1-9]\d{0,4}$/)
      .default("1"),
  })
  .strict();
export type DirectoryQuery = z.infer<typeof directoryQuery>;
export type DirectoryPlayer = {
  id: string;
  name: string;
  role: string;
  teams: string[];
  games: number;
  ops: number | null;
  era: number | null;
  score: number | null;
  confidence: string | null;
  lastAppearance: string | null;
  source: string;
};
export type DirectoryResult = {
  players: DirectoryPlayer[];
  total: number;
  page: number;
  pages: number;
  asOf: string;
  updatedAt: string;
  source: string;
  season: number;
};

export const directoryResponse: z.ZodType<DirectoryResult> = z.object({
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      teams: z.array(z.string()),
      games: z.number().int().nonnegative(),
      ops: z.number().nullable(),
      era: z.number().nullable(),
      score: z.number().nullable(),
      confidence: z.string().nullable(),
      lastAppearance: z.string().nullable(),
      source: z.string(),
    }),
  ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
  asOf: z.string(),
  updatedAt: z.string(),
  source: z.string(),
  season: z.number().int(),
});
