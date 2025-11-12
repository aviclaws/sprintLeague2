import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUserByUsername } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: "missing" }, { status: 400 });

  const user = await getUserByUsername(username);
  if (!user) return NextResponse.json({ error: "invalid" }, { status: 401 });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 401 });

  const token = jwt.sign(
    { sub: user.username, role: user.role, team: user.team ?? null },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set("sl_session", token, {
    httpOnly: true, sameSite: "lax", secure: false, path: "/"
  });
  return res;
}
