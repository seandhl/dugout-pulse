import "server-only";
import { z } from "zod";
import { ApiError } from "./errors";
export function queryInput(request: Request) {
  const params = new URL(request.url).searchParams;
  if (new Set(params.keys()).size !== [...params.keys()].length)
    throw new ApiError("BAD_INPUT", 400, "중복 쿼리는 허용하지 않습니다.");
  params.delete("releaseId"); // Transport identity is validated/pinned before domain query parsing.
  return Object.fromEntries(params);
}
export async function respond(schema: z.ZodType, run: () => Promise<unknown>) {
  try {
    return Response.json(schema.parse(await run()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const failure =
      error instanceof ApiError
        ? error
        : new ApiError("INTERNAL_ERROR", 500, "응답을 제공하지 못했습니다.");
    return Response.json(
      {
        data: null,
        meta: null,
        pagination: null,
        error: {
          code: failure.code,
          message: failure.message,
          requestId: crypto.randomUUID(),
        },
      },
      { status: failure.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function input<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError("BAD_INPUT", 400, "입력 조건을 확인해 주세요.");
  return result.data;
}
