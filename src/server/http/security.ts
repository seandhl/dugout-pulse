/** A bounded per-process budget. Deployment ingress must enforce a shared limit. */
const windows = new Map<string, { count: number; until: number }>();
export function consumeBudget(key: string, limit: number, now = Date.now()) {
  for (const [name, entry] of windows)
    if (entry.until <= now) windows.delete(name);
  const entry = windows.get(key) ?? { count: 0, until: now + 60_000 };
  if (!windows.has(key) && windows.size >= 1000) return false;
  windows.set(key, entry);
  return ++entry.count <= limit;
}
export function securityHeaders(production: boolean) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
        `connect-src 'self'${production ? "" : " ws: wss:"}`,
      ].join("; "),
    },
    ...(production
      ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
      : []),
  ];
}
