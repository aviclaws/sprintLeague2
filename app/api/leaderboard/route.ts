import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic"; export const revalidate = 0;

export async function GET() {
  const db = getPool();
  // bring all runs with current team
  const { rows } = await db.query(`
    select r.id, r.username, u.team, r.duration_ms, r.created_at
      from runs r
      left join users u on lower(u.username)=lower(r.username)
  `);

  // sort fastest → slowest
  rows.sort((a: any, b: any) => (a.duration_ms ?? 0) - (b.duration_ms ?? 0));

  // per-user index
  const counters: Record<string, number> = {};
  const out = rows.map((r: any) => {
    const key = String(r.username || "").trim().toLowerCase();
    counters[key] = (counters[key] ?? 0) + 1;
    return {
      id: r.id,
      index: counters[key],
      username: r.username,
      team: r.team ?? "Bench",
      duration_ms: r.duration_ms,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ rows: out }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}
