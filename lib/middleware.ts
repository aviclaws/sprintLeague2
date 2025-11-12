// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const PROTECTED = [/^\/player/, /^\/coach/, /^\/api\/protected/, /^\/api\/runs/, /^\/api\/leaderboard/, /^\/api\/scoreboard/];

export function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  const needsAuth = PROTECTED.some(rx => rx.test(url));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("sl_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const res = NextResponse.next();
    res.headers.set("x-user", JSON.stringify(payload));
    return res;
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/player/:path*", "/coach/:path*", "/api/:path*"]
};
