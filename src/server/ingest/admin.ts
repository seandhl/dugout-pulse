import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { FileError } from "./files";
export const sessionCookie = "__Host-dugout-admin";
const equal = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function assertInternal(request: Request) {
  if (process.env.APP_ENV && process.env.APP_ENV !== "local")
    throw new FileError(403, "배포 DEMO는 읽기 전용입니다.");
  const allowed = process.env.ADMIN_ORIGIN;
  const url = new URL(request.url);
  const origin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (
    !allowed ||
    origin !== allowed ||
    (process.env.NODE_ENV === "production" && !allowed.startsWith("https://"))
  )
    throw new FileError(
      403,
      "관리자 내부 origin이 설정되지 않았거나 접근이 차단되었습니다.",
    );
  const supplied = request.headers.get("origin");
  if (supplied && supplied !== allowed)
    throw new FileError(403, "다른 출처의 요청입니다.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new FileError(403, "교차 사이트 요청 차단");
}
export function verifyToken(token: string) {
  const expected = process.env.INGEST_ADMIN_TOKEN_SHA256;
  return (
    !!expected &&
    /^[a-f0-9]{64}$/.test(expected) &&
    /^[\x21-\x7e]{32,256}$/.test(token) &&
    equal(expected, createHash("sha256").update(token).digest("hex"))
  );
}
function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}
export function issueSession() {
  if (secret().length < 64 || !process.env.ADMIN_ACTOR_ID)
    throw new FileError(503, "관리자 세션 설정 필요");
  const payload = Buffer.from(
    JSON.stringify({
      role: "ADMIN",
      actor: process.env.ADMIN_ACTOR_ID,
      exp: Date.now() + 15 * 60_000,
      nonce: randomBytes(24).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("hex")}`;
}
export function principal(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1);
  if (!value || secret().length < 64)
    throw new FileError(403, "ADMIN 세션 필요");
  const [payload, signature, extra] = value.split(".");
  if (
    !payload ||
    !signature ||
    extra !== undefined ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !equal(
      signature,
      createHmac("sha256", secret()).update(payload).digest("hex"),
    )
  )
    throw new FileError(403, "유효하지 않은 세션");
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      p.role !== "ADMIN" ||
      p.actor !== process.env.ADMIN_ACTOR_ID ||
      !Number.isFinite(p.exp) ||
      p.exp <= Date.now()
    )
      throw new Error();
    return { role: "ADMIN" as const, actor: String(p.actor) };
  } catch {
    throw new FileError(403, "만료되거나 유효하지 않은 세션");
  }
}
const attempts = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, limit = 60) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  const entry = attempts.get(key) ?? { count: 0, until: now + 60_000 };
  if (attempts.size >= 10000 && !attempts.has(key))
    throw new FileError(429, "요청 한도 초과");
  attempts.set(key, entry);
  if (++entry.count > limit) throw new FileError(429, "요청 한도 초과");
}
export function assertAdmin(request: Request) {
  assertInternal(request);
  const p = principal(request);
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== process.env.ADMIN_ORIGIN
  )
    throw new FileError(403, "동일 출처 승인 필요");
  rateLimit(p.actor);
  return p;
}
