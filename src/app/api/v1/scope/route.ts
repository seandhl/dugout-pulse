import { observeRequest } from "@/server/observability/runtime";
import { pipeline } from "@/server/ingest/pipeline";
import { scopeInput, kstDate } from "@/server/reads/scope";
import { failure } from "@/server/ingest/service";
export const runtime = "nodejs";
async function handleGET(request: Request) {
  const values = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = scopeInput.safeParse({
    season: Number(kstDate(new Date().toISOString()).slice(0, 4)),
    ...values,
  });
  if (!parsed.success)
    return Response.json(
      { error: "날짜·시즌·조회 조건을 확인하세요" },
      { status: 400 },
    );
  try {
    return Response.json(await pipeline.scope(parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request));
}
