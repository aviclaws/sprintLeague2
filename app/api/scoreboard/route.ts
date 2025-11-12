import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic"; export const revalidate = 0;

export async function GET() {
  const db = getPool();
  // Sum runs grouped by CURRENT team from users
  const { rows } = await db.query(`
    select u.team, coalesce(sum(r.duration_ms),0) as total
      from users u
      left join runs r on lower(r.username)=lower(u.username)
     group by u.team
  `);

  let blue = 0, white = 0;
  for (const r of rows) {
    if (r.team === "Blue") blue = Number(r.total) || 0;
    else if (r.team === "White") white = Number(r.total) || 0;
  }
  return NextResponse.json({ blue, white }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}
