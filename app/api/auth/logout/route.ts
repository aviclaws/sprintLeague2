// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // clear the cookie
  const res = NextResponse.redirect(new URL("/login", req.url), { status: 302 });
  res.cookies.set("sl_session", "", {
    httpOnly: true,
    secure: false,   // keep false on http://localhost
    sameSite: "lax",
    path: "/",
    maxAge: 0,       // expire immediately
  });
  return res;
}
