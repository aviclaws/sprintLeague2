import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUser } from "@/lib/users";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

async function readCreds(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({} as any));
    return { username: (body.username || "").trim(), password: body.password || "" };
  }
  const form = await req.formData();
  return {
    username: String(form.get("username") || "").trim(),
    password: String(form.get("password") || ""),
  };
}

export async function POST(req: NextRequest) {
  const { username, password } = await readCreds(req);
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const user = findUser(username);
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  // accept bcrypt OR plaintext (dev)
  let ok = false;
  const anyUser = user as any;
  if (anyUser.password_hash?.startsWith?.("$2")) {
    ok = await bcrypt.compare(password, anyUser.password_hash);
  } else if (anyUser.password) {
    ok = password === anyUser.password;
  }
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Missing JWT_SECRET in .env.local" }, { status: 500 });
  }

  const token = jwt.sign(
    { sub: user.username, role: user.role, team: user.team ?? null },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // ⬇️ await the cookie store, then set
  const store = await cookies();
  store.set("sl_session", token, {
    httpOnly: true,
    secure: false,      // keep false on http://localhost
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  const target = user.role === "coach" ? "/coach" : "/player";
  return NextResponse.redirect(new URL(target, req.url), { status: 302 });
}
