import { observeRequest } from "@/server/observability/runtime";
import { assertAdmin } from "@/server/ingest/admin";
import { demoRights } from "@/server/ingest/pipeline";
import { failure } from "@/server/ingest/service";
async function handleGET(request: Request) {
  try {
    assertAdmin(request);
    return Response.json(
      {
        mode: "DEMO",
        rights: demoRights,
        realImportEnabled: false,
        realDeleteEnabled: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request));
}
