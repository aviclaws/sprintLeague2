// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // Never guard auth endpoints or whoami
  if (p.startsWith("/api/auth") || p === "/api/whoami") {
    return NextResponse.next();
  }

  // Protect /player, /coach, and all other /api/*
  const protectedPaths = [/^\/player/, /^\/coach/, /^\/api\//];
  const needsAuth = protectedPaths.some(rx => rx.test(p));
  if (!needsAuth) return NextResponse.next();

  // ✅ Only check for the presence of the cookie here
  const hasCookie = !!req.cookies.get("sl_session")?.value;
  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // No JWT verification in middleware (Edge). Let route handlers verify.
  return NextResponse.next();
}

export const config = { matcher: ["/player/:path*", "/coach/:path*", "/api/:path*"] };
