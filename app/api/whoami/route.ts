import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    const store = await cookies();
    const raw = store.get("sl_session")?.value;
    if (!raw) return NextResponse.json({ ok: false }, { status: 401 });
    const payload = jwt.verify(raw, process.env.JWT_SECRET!) as any;
    return NextResponse.json({
      username: payload.sub,
      role: payload.role,
      team: payload.team ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 401 });
  }
}
