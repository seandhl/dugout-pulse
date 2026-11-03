import { readDemo } from "@/server/db/demo";
import { parseEnv } from "@/config/env";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    parseEnv(process.env);
    readDemo();
    return Response.json(
      {
        status: "ready",
        mode: "DEMO",
        schemaVersion: 1,
        importStatus: "canonical_fixture_verified",
        externalImport: "disabled",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", mode: "DEMO" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
