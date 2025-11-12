import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const me = await requireUser(); // { sub: username, role, team }
    const rows = await sql/*sql*/`
      select coalesce(avg(duration_ms), 0)::bigint as avg_ms
      from runs
      where lower(username) = lower(${me.sub})
    `;
    const avg_ms = Number(rows[0]?.avg_ms ?? 0);
    return NextResponse.json({ avg_ms }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}
