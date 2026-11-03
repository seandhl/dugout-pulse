import { observeRequest } from "@/server/observability/runtime";
import { directoryQuery } from "@/contracts/player-directory";
import { readDirectory } from "@/server/reads/player-directory";
import { input, queryInput } from "@/server/http/response";
import { ApiError } from "@/server/http/errors";
export const dynamic = "force-dynamic";
function handleGET(request: Request) {
  try {
    return Response.json(
      readDirectory(input(directoryQuery, queryInput(request))),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : "선수 목록을 불러오지 못했습니다.",
      },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request));
}
