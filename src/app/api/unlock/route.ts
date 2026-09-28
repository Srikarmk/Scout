import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.SCOUT_ACCESS_TOKEN;
  if (!secret) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token || body.token !== secret) {
    // Slow down trivial guessing without pretending this is a real auth system.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: "wrong access token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
