import { observeRequest } from "@/server/observability/runtime";
import { id } from "@/contracts/api";
import { detailQuery, selectPlayerDetail } from "@/server/reads/player-detail";
import { readDemo } from "@/server/db/demo";
import { input, queryInput } from "@/server/http/response";
import { ApiError } from "@/server/http/errors";
export const dynamic = "force-dynamic";
async function handleGET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = input(id, (await params).id);
    const query = input(detailQuery, queryInput(request));
    const data = selectPlayerDetail(readDemo(), playerId, query.window);
    if (!data) throw new ApiError("NOT_FOUND", 404, "타자 상세가 없습니다.");
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ApiError
            ? e.message
            : "상세 데이터를 불러오지 못했습니다.",
      },
      { status: e instanceof ApiError ? e.status : 500 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return observeRequest(() => handleGET(request, { params }));
}
