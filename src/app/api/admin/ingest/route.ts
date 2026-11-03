import { observeRequest } from "@/server/observability/runtime";
import { stage, failure } from "@/server/ingest/service";
export const runtime = "nodejs";
async function handlePOST(request: Request) {
  try {
    return Response.json(await stage(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  return observeRequest(() => handlePOST(request));
}
