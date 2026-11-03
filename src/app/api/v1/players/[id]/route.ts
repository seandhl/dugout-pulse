import { observeRequest } from "@/server/observability/runtime";
import { playerParams, playerResponse, scopeQuery } from "@/contracts/api";
import { playersService } from "@/server/composition";
import { input, queryInput, respond } from "@/server/http/response";
export const dynamic = "force-dynamic";
function handleGET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(playerResponse, async () =>
    playersService.find(
      input(playerParams, await context.params).id,
      input(scopeQuery, queryInput(request)),
    ),
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return observeRequest(() => handleGET(request, context), request);
}
