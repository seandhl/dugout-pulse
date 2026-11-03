import { z } from "zod";
export const errorCode = z.enum([
  "BAD_INPUT",
  "NOT_FOUND",
  "DATA_UNAVAILABLE",
  "STALE_DATA",
  "FORBIDDEN",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const scopeQuery = z
  .object({
    season: z
      .string()
      .regex(/^\d{4}$/)
      .transform(Number)
      .pipe(z.number().min(1900))
      .default(() =>
        Number(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 4)),
      ),
    competition: z
      .enum(["regular", "postseason", "allstar", "exhibition"])
      .default("regular"),
  })
  .strict();
export const playersQuery = scopeQuery
  .extend({
    role: z.enum(["batter", "starter", "reliever"]).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(["name_asc", "name_desc"]).default("name_asc"),
    limit: z
      .string()
      .regex(/^[1-9]\d?$/)
      .transform(Number)
      .pipe(z.number().max(20))
      .default(20),
    cursor: z.string().max(2048).optional(),
  })
  .strict();
export const playerParams = z.object({ id }).strict();
export const playerSchema = z
  .object({
    playerId: id,
    displayName: z.string(),
    listedRoles: z.array(z.enum(["batter", "starter", "reliever"])),
    sourceId: id,
    sampleSize: z.number().int().nonnegative(),
    teamId: id.optional(),
    stats: z.record(z.string(), z.number().int().nonnegative()).optional(),
  })
  .strict();
export const metaSchema = z
  .object({
    asOf: z.iso.datetime().nullable(),
    sourceMode: z.literal("DEMO"),
    demo: z.literal(true),
    season: z.number().int(),
    competition: z.enum(["regular", "postseason", "allstar", "exhibition"]),
    lastUpdatedAt: z.iso.datetime().nullable(),
    releaseId: id.nullable(),
  })
  .strict();
export const paginationSchema = z
  .object({
    limit: z.number().int(),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
  .strict();
export const errorSchema = z
  .object({ code: errorCode, message: z.string(), requestId: z.string() })
  .strict();
export function responseSchema<T extends z.ZodType>(data: T) {
  return z.union([
    z
      .object({
        data,
        meta: metaSchema,
        pagination: paginationSchema.nullable(),
        error: z.null(),
      })
      .strict(),
    z
      .object({
        data: z.null(),
        meta: metaSchema.nullable(),
        pagination: z.null(),
        error: errorSchema,
      })
      .strict(),
  ]);
}
export const playersResponse = responseSchema(z.array(playerSchema));
export const playerResponse = responseSchema(playerSchema);
export const catalogSchema = z
  .object({
    dataStatus: z.literal("demo_fixture"),
    roles: z.array(z.enum(["batter", "starter", "reliever"])),
    attribution: z.string(),
  })
  .strict();
export const metaResponse = responseSchema(catalogSchema);
export type Player = z.infer<typeof playerSchema>;
export type Meta = z.infer<typeof metaSchema>;
export type PlayersQuery = z.infer<typeof playersQuery>;
