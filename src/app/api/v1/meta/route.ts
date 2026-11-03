import { observeRequest } from "@/server/observability/runtime";
import { metaResponse, scopeQuery } from "@/contracts/api";
import { playersService } from "@/server/composition";
import { input, queryInput, respond } from "@/server/http/response";
export const dynamic = "force-dynamic";
function handleGET(request: Request) {
  return respond(metaResponse, async () => ({
    data: {
      dataStatus: "demo_fixture",
      roles: ["batter", "starter", "reliever"],
      attribution:
        "자체 제작 가상 DEMO. lastUpdatedAt은 fixture 제작 시각이며 외부 데이터 동기화 이력이 아닙니다.",
    },
    meta: await playersService.meta(input(scopeQuery, queryInput(request))),
    pagination: null,
    error: null,
  }));
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request), request);
}
