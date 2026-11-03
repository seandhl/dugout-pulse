import { observeRequest } from "@/server/observability/runtime";
import {
  assertInternal,
  issueSession,
  rateLimit,
  sessionCookie,
  verifyToken,
} from "@/server/ingest/admin";
import { boundedBody, failure } from "@/server/ingest/service";
import { FileError } from "@/server/ingest/files";
async function handlePOST(request: Request) {
  try {
    assertInternal(request);
    rateLimit("login", 5);
    if (request.headers.get("origin") !== process.env.ADMIN_ORIGIN)
      throw new FileError(403, "동일 출처 필요");
    const body = await boundedBody(request);
    if (body.length > 1024) throw new FileError(413, "요청 한도 초과");
    const token = new URLSearchParams(body.toString()).get("token") ?? "";
    if (!verifyToken(token)) throw new FileError(403, "인증 실패");
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin",
        "Cache-Control": "no-store",
        "Set-Cookie": `${sessionCookie}=${issueSession()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
async function handleDELETE(request: Request) {
  try {
    assertInternal(request);
    if (request.headers.get("origin") !== process.env.ADMIN_ORIGIN)
      throw new FileError(403, "동일 출처 필요");
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie": `${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  return observeRequest(() => handlePOST(request));
}

export async function DELETE(request: Request) {
  return observeRequest(() => handleDELETE(request));
}
