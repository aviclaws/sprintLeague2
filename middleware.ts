// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // Never touch API, Next internals, static assets, or /login
  if (
    p.startsWith("/api") ||
    p.startsWith("/_next") ||
    p === "/favicon.ico" ||
    p.startsWith("/public") ||
    p.startsWith("/login")
  ) {
    return NextResponse.next();
  }

  // Protect app pages (player/coach/anything else you like)
  const hasCookie = !!req.cookies.get("sl_session")?.value;
  const protectedPaths = [/^\/player/, /^\/coach/];
  const needsAuth = protectedPaths.some((rx) => rx.test(p));

  if (needsAuth && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Only run on app routes, not API
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|login).*)"],
};
