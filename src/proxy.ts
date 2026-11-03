import {
  withPublication,
  publicationIdentity,
} from "./server/repositories/publication";
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
    return bindRelease(request);
  }
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin"))
    return ["/", "/compare", "/rankings", "/published"].includes(pathname) ||
      pathname.startsWith("/players")
      ? bindRelease(request)
      : staticReleaseTransport(request);
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

function bindRelease(request: NextRequest) {
  const values = request.nextUrl.searchParams.getAll("releaseId");
  const requested = request.headers.get("x-pulse-release") ?? values[0];
  if (
    values.length > 1 ||
    (values[0] &&
      request.headers.has("x-pulse-release") &&
      values[0] !== request.headers.get("x-pulse-release")) ||
    (requested && !/^[a-zA-Z0-9_-]{1,100}$/.test(requested))
  )
    return NextResponse.json(
      { error: "릴리스 조건을 확인하세요." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const identity = withPublication(requested, publicationIdentity);
    const h = new Headers(request.headers);
    h.set("x-pulse-release", identity.releaseId);
    return NextResponse.next({ request: { headers: h } });
  } catch {
    return NextResponse.json(
      { error: "게시 릴리스 연결 대기 중입니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// Informational/legal pages remain reachable during publication failures, while
// their links can carry an existing release through a full-page navigation.
function staticReleaseTransport(request: NextRequest) {
  const values = request.nextUrl.searchParams.getAll("releaseId");
  if (values.length !== 1 || !/^[a-zA-Z0-9_-]{1,100}$/.test(values[0]))
    return NextResponse.next();
  const h = new Headers(request.headers);
  h.set("x-pulse-release", values[0]);
  return NextResponse.next({ request: { headers: h } });
}
