import "server-only";
import { randomBytes } from "node:crypto";
import { parseEnv } from "../config/env";
import { demoRepository } from "./repositories/demo";
import { createPlayerService } from "./reads/players";
parseEnv(process.env);
const state = globalThis as typeof globalThis & { demoCursorKey?: string };
state.demoCursorKey ??= randomBytes(32).toString("hex");
export const playersService = createPlayerService(
  demoRepository,
  state.demoCursorKey,
);
