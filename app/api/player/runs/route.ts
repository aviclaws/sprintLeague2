import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const me = await requireUser();
    const rows = await sql/*sql*/`
      select id, username, duration_ms, created_at
      from runs
      where lower(username) = lower(${me.sub})
      order by created_at desc
    `;
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}
