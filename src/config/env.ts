import { z } from "zod";
export const envSchema = z.object({
  APP_ENV: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["local", "demo", "staging", "production"]).default("local"),
  ),
  PUBLICATION_STATE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["demo", "maintenance"]).default("demo"),
  ),
  DEMO_PROFILE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["default", "performance"]).default("default"),
  ),
  DATA_MODE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.literal("DEMO").default("DEMO"),
  ),
});
export function parseEnv(input: Record<string, unknown>) {
  return envSchema.parse(input);
}
