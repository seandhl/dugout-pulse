import { observeRequest } from "@/server/observability/runtime";
import { audit } from "@/server/ingest/audit";
import { z } from "zod";
import { assertAdmin } from "@/server/ingest/admin";
import { pipeline } from "@/server/ingest/pipeline";
import { boundedBody, failure } from "@/server/ingest/service";
import { FileError } from "@/server/ingest/files";
export const runtime = "nodejs";
async function handlePOST(request: Request) {
  try {
    assertAdmin(request);
    const text = (await boundedBody(request)).toString("utf8");
    if (text.length > 1024) throw new FileError(413, "요청 한도 초과");
    const parsed = z
      .object({
        batchId: z.uuid(),
        approve: z.literal(true),
        checklist: z
          .object({
            collect: z.literal(true),
            store: z.literal(true),
            display: z.literal(true),
            transform: z.literal(true),
            export: z.literal(true),
          })
          .strict(),
      })
      .strict()
      .safeParse(JSON.parse(text));
    if (!parsed.success)
      throw new FileError(
        400,
        "배치 ID와 명시적 승인(approve: true)이 필요합니다.",
      );
    await audit(request, "PUBLISH_REQUESTED", parsed.data.batchId);
    const result = await pipeline.publish(parsed.data.batchId);
    await audit(
      request,
      result.published ? "PUBLISHED" : "PUBLISH_REJECTED",
      parsed.data.batchId,
    );
    return Response.json(result, {
      status: result.published ? 200 : 422,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return failure(new FileError(400, "JSON 구문 오류"));
    return failure(error);
  }
}

export async function POST(request: Request) {
  return observeRequest(() => handlePOST(request));
}
