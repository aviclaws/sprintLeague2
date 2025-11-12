// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findUser } from "@/lib/users";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  const user = findUser(username);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  // If you insist on plaintext: const ok = password === (user as any).password;
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = jwt.sign(
    { sub: user.username, role: user.role, team: user.team ?? null },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  const res = NextResponse.json({ success: true, role: user.role });
  res.cookies.set("sl_session", token, {
    httpOnly: true,
    secure: false, // set true in production under HTTPS
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return res;
}
