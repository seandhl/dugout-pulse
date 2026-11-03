import { observeRequest } from "@/server/observability/runtime";
import { rankingsQuery, momentumResponse } from "@/contracts/momentum";
import { pipeline } from "@/server/ingest/pipeline";
import { momentumView } from "@/server/reads/momentum";
import { input, queryInput, respond } from "@/server/http/response";
export const dynamic = "force-dynamic";
function handleGET(request: Request) {
  return respond(momentumResponse, async () => {
    const query = input(rankingsQuery, queryInput(request));
    return momentumView(await pipeline.readPublicState(), query);
  });
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request), request);
}
