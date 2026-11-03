import { observeRequest } from "@/server/observability/runtime";
import { playerParams } from "@/contracts/api";
import { momentumQuery, momentumResponse } from "@/contracts/momentum";
import { pipeline } from "@/server/ingest/pipeline";
import { momentumView } from "@/server/reads/momentum";
import { input, queryInput, respond } from "@/server/http/response";
import { ApiError } from "@/server/http/errors";
export const dynamic = "force-dynamic";
function handleGET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(momentumResponse, async () => {
    const { id } = input(playerParams, await context.params);
    const query = input(momentumQuery, queryInput(request));
    const state = await pipeline.readPublicState();
    if (
      !Object.values(state.records).some(
        (r) =>
          r.kind === "players" &&
          r.row.player_id === id &&
          r.row.season === query.season &&
          r.row.competition === query.competition,
      )
    )
      throw new ApiError("NOT_FOUND", 404, "선수가 없습니다.");
    return momentumView(state, query, id);
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return observeRequest(() => handleGET(request, context), request);
}
