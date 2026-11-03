import type { NextConfig } from "next";
import { parseEnv } from "./src/config/env";
import { securityHeaders } from "./src/server/http/security";
parseEnv(process.env);
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "production"),
      },
    ];
  },
  // Keep the dedicated ingest browser test separate from an active dev server.
  distDir: process.env.INGEST_E2E === "1" ? ".next-ingest-e2e" : ".next",
};
export default nextConfig;
