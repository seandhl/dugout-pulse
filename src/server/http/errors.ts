import "server-only";
import type { z } from "zod";
import type { errorCode } from "../../contracts/api";
export class ApiError extends Error {
  constructor(
    public code: z.infer<typeof errorCode>,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
