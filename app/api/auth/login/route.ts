// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUserByUsername } from "@/lib/users";

function bad(msg: string, code = 400) {
  console.log("[API /login] error", code, msg); // ← SERVER log
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: NextRequest) {
  if (!process.env.JWT_SECRET) {
    return NextResponse.json(
      { ok: false, error: "server misconfig: JWT_SECRET missing" },
      { status: 500 }
    );
  }
  console.log("[API /login] start", Date.now()); // ← SERVER log
  let username = "", password = "";
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const b = await req.json();
      username = String(b?.username ?? "");
      password = String(b?.password ?? "");
    } else {
      const text = await req.text();
      const p = new URLSearchParams(text);
      username = String(p.get("username") ?? "");
      password = String(p.get("password") ?? "");
    }
  } catch {
    return bad("Invalid payload", 400);
  }
  if (!username || !password) return bad("username and password required", 400);

  try {
    const user = await getUserByUsername(username);
    if (!user) return bad("invalid credentials", 401);

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return bad("invalid credentials", 401);

    const role = (user.role || "").toLowerCase(); // "coach" | "player"
    const token = jwt.sign(
      { sub: user.username, role, team: user.team ?? null },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    const res = NextResponse.json({ ok: true, role }, { status: 200 });
    res.cookies.set("sl_session", token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    });
    console.log("[API /login] ok", user.username); // ← SERVER log
    return res;
  } catch (e) {
    console.error("[API /login] exception", e); // ← SERVER log
    return bad("server error", 500);
  }
}
