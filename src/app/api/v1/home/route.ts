import { observeRequest } from "@/server/observability/runtime";
import { homeQuery, homeResponse } from "@/contracts/home";
import { readHome } from "@/server/reads/home";
import { input, queryInput, respond } from "@/server/http/response";
export const dynamic = "force-dynamic";
function handleGET(request: Request) {
  return respond(homeResponse, async () =>
    readHome(input(homeQuery, queryInput(request))),
  );
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request), request);
}
