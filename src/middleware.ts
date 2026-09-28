import { NextRequest, NextResponse } from "next/server";

export const COOKIE = "scout_access";

/** Constant-time compare: Node's timingSafeEqual is not available on the edge runtime. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * When SCOUT_ACCESS_TOKEN is set (any public deployment), every route needs the
 * shared secret. A deployed Scout can spend real API credits, so an open URL is
 * an open wallet. Unset locally, which leaves the app completely ungated.
 */
export function middleware(request: NextRequest) {
  const secret = process.env.SCOUT_ACCESS_TOKEN;
  if (!secret) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE)?.value;
  if (cookie && sameSecret(cookie, secret)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/unlock" || pathname === "/api/unlock") return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
