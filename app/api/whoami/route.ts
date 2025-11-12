// app/api/whoami/route.ts
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, username: s.sub, role: s.role, team: s.team });
}
