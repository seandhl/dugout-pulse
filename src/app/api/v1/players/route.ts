import { observeRequest } from "@/server/observability/runtime";
import { playersQuery, playersResponse } from "@/contracts/api";
import { playersService } from "@/server/composition";
import { input, queryInput, respond } from "@/server/http/response";
export const dynamic = "force-dynamic";
function handleGET(request: Request) {
  return respond(playersResponse, () =>
    playersService.list(input(playersQuery, queryInput(request))),
  );
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request));
}
