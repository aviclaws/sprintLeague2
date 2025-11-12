// app/api/scoreboard/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Only count Blue/White teams; nulls ignored
  const rows = await sql/*sql*/`
    select u.team, coalesce(sum(r.duration_ms), 0)::bigint as total
    from users u
    left join runs r on lower(r.username) = lower(u.username)
    where u.team in ('Blue','White')
    group by u.team
  `;

  let blue = 0, white = 0;
  for (const r of rows as Array<{ team: 'Blue' | 'White'; total: string | number }>) {
    const n = Number(r.total) || 0;
    if (r.team === "Blue") blue = n;
    else if (r.team === "White") white = n;
  }

  return NextResponse.json(
    { blue, white },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
