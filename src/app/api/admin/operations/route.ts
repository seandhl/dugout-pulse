import { assertAdmin } from "@/server/ingest/admin";
import { failure } from "@/server/ingest/service";
import { operations } from "@/server/observability/service";
import { observeJob, observeRequest } from "@/server/observability/runtime";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return observeRequest(async () => {
    try {
      assertAdmin(request);
      return Response.json(await operations(), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return failure(error);
    }
  });
}
export async function POST(request: Request) {
  return observeRequest(async () => {
    try {
      assertAdmin(request);
      return Response.json(await observeJob(() => operations(true)), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return failure(error);
    }
  });
}
