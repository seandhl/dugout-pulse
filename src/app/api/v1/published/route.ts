import { observeRequest } from "@/server/observability/runtime";
import { pipeline } from "@/server/ingest/pipeline";
import { scopeInput, kstDate } from "@/server/reads/scope";
import { ApiError } from "@/server/http/errors";
import { queryInput } from "@/server/http/response";
import { failure } from "@/server/ingest/service";
export const runtime = "nodejs";
async function handleGET(request: Request) {
  try {
    const params = queryInput(request);
    const parsed = scopeInput
      .pick({ season: true, competition: true })
      .safeParse({
        season: Number(kstDate(new Date().toISOString()).slice(0, 4)),
        ...params,
      });
    if (!parsed.success)
      return Response.json(
        { error: "지원하지 않는 시즌·대회" },
        { status: 400 },
      );
    const { season, competition } = parsed.data;
    return Response.json(await pipeline.publicResults(season, competition), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    return failure(error);
  }
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request), request);
}
