import { observeRequest } from "@/server/observability/runtime";
import { assertAdmin } from "@/server/ingest/admin";
import { template, failure } from "@/server/ingest/service";
export const runtime = "nodejs";
async function handleGET(request: Request) {
  try {
    assertAdmin(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind"),
      format = params.get("format") ?? "csv";
    const bytes = await template(
      kind,
      format,
      params.get("variant") ?? "example",
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${kind}${params.get("variant") && params.get("variant") !== "example" ? `-${params.get("variant")}` : ""}.${format}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request) {
  return observeRequest(() => handleGET(request));
}
