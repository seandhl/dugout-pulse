import { observeRequest } from "@/server/observability/runtime";
import { z } from "zod";
import { assertAdmin } from "@/server/ingest/admin";
import { audit } from "@/server/ingest/audit";
import { boundedBody, failure } from "@/server/ingest/service";
import { pipeline } from "@/server/ingest/pipeline";
import { FileError } from "@/server/ingest/files";
async function handlePOST(request: Request) {
  try {
    assertAdmin(request);
    const input = z
      .object({ batchId: z.uuid(), confirmation: z.literal("ROLLBACK DEMO") })
      .strict()
      .safeParse(JSON.parse((await boundedBody(request)).toString()));
    if (!input.success)
      throw new FileError(400, "배치 ID와 ROLLBACK DEMO 확인 필요");
    await audit(request, "ROLLBACK_REQUESTED", input.data.batchId);
    const result = await pipeline.rollback(input.data.batchId);
    await audit(request, "ROLLBACK_COMPLETED", input.data.batchId);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  return observeRequest(() => handlePOST(request));
}
