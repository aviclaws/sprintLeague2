// lib/runs.ts
import { sql } from "./db";
import type { Team } from "./users";

export type RunRow = {
  id: number;
  username: string;
  team: Team;
  duration_ms: number;
  created_at: string; // ISO timestamp
};

export async function listRuns() {
  const rows = await sql/*sql*/`
    select r.id, r.username, u.team, r.duration_ms, r.created_at
    from runs r
    left join users u on lower(u.username) = lower(r.username)
    order by r.created_at desc
  `;
  return rows as RunRow[];
}

export async function addRun(username: string, duration_ms: number) {
  await sql/*sql*/`
    insert into runs (username, duration_ms)
    values (${username}, ${duration_ms})
  `;
}

export async function updateRunById(
  id: number,
  fields: { username?: string; duration_ms?: number }
) {
  if (fields.username !== undefined && fields.duration_ms !== undefined) {
    await sql/*sql*/`
      update runs
      set username = ${fields.username}, duration_ms = ${fields.duration_ms}
      where id = ${id}
    `;
  } else if (fields.username !== undefined) {
    await sql/*sql*/`
      update runs
      set username = ${fields.username}
      where id = ${id}
    `;
  } else if (fields.duration_ms !== undefined) {
    await sql/*sql*/`
      update runs
      set duration_ms = ${fields.duration_ms}
      where id = ${id}
    `;
  }
}

export async function deleteRunById(id: number) {
  await sql/*sql*/`delete from runs where id = ${id}`;
}

/**
 * Count how many runs this user has submitted "today" (UTC day).
 * Used to enforce the 10-run daily limit.
 */
export async function countRunsToday(username: string): Promise<number> {
  const now = new Date();
  const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  const rows = await sql/*sql*/`
    select count(*)::int as count
    from runs
    where lower(username) = lower(${username})
      and created_at >= ${startUTC.toISOString()}
      and created_at <  ${endUTC.toISOString()}
  `;

  const count = (rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  return count;
}
