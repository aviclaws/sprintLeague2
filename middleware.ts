import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  const protectedPaths = [/^\/player/, /^\/coach/, /^\/api\/(?!auth)/];
  const needsAuth = protectedPaths.some(rx => rx.test(url));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("sl_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    const res = NextResponse.next();
    res.headers.set("x-user", JSON.stringify(payload));
    return res;
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = { matcher: ["/player/:path*", "/coach/:path*", "/api/:path*"] };
