import { NextResponse, type NextRequest } from "next/server";
import { assertInternal, principal } from "./server/ingest/admin";
import { consumeBudget } from "./server/http/security";
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hosted = !!process.env.APP_ENV && process.env.APP_ENV !== "local";
  if (
    hosted &&
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin"))
  )
    return new NextResponse("배포 DEMO는 읽기 전용입니다.", { status: 403 });
  if (
    process.env.PUBLICATION_STATE &&
    process.env.PUBLICATION_STATE !== "demo" &&
    ![
      "/about",
      "/legal",
      "/privacy",
      "/data-terms",
      "/api/health",
      "/api/ready",
    ].includes(pathname)
  ) {
    const headers = { "Cache-Control": "no-store", "Retry-After": "300" };
    return pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: "MAINTENANCE", mode: "DEMO" },
          { status: 503, headers },
        )
      : new NextResponse(
          '<!doctype html><html lang="ko"><meta charset="utf-8"><title>게시 중단</title><h1>점검 중입니다</h1><p>데이터 권리 또는 운영 상태 확인으로 게시를 중단했습니다. DEMO 서비스입니다.</p><a href="/legal">개인정보·권리·면책 안내</a></html>',
          {
            status: 503,
            headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
          },
        );
  }
  if (request.nextUrl.pathname.startsWith("/api/v1/")) {
    // Do not trust client supplied forwarding headers as an identity.
    if (!consumeBudget("public-api", 300))
      return NextResponse.json(
        { error: "요청 한도 초과" },
        {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        },
      );
    if (request.nextUrl.search.length > 4096)
      return NextResponse.json(
        { error: "쿼리 길이 한도 초과" },
        { status: 414 },
      );
    return NextResponse.next();
  }
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin"))
    return NextResponse.next();
  try {
    assertInternal(request);
    if (
      request.nextUrl.pathname !== "/admin/login" &&
      request.nextUrl.pathname !== "/api/admin/session"
    )
      principal(request);
    return NextResponse.next();
  } catch {
    return new NextResponse("관리자 접근이 차단되었습니다.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
