// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "America/New_York";

export async function GET() {
  // Only include runs created "today" in America/New_York.
  // Order by chronological submission time.
  // Compute a per-user index (1,2,3,...) for today using row_number(), ordered by created_at.
  const rows = await sql/*sql*/`
    select
      r.id,
      r.username,
      coalesce(u.team, 'Bench') as team,
      r.duration_ms,
      r.created_at,
      row_number() over (
        partition by lower(r.username)
        order by r.created_at asc
      ) as "index"
    from runs r
    left join users u on lower(u.username) = lower(r.username)
    where (r.created_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date
    order by r.created_at asc
  `;

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}
