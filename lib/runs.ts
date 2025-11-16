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

/**
 * List all runs (latest first) — unchanged utility.
 */
export async function listRuns() {
  const rows = await sql/*sql*/`
    select r.id, r.username, u.team, r.duration_ms, r.created_at
    from runs r
    left join users u on lower(u.username) = lower(r.username)
    order by r.created_at desc
  `;
  return rows as RunRow[];
}

/**
 * Insert a new run for the given username and duration.
 */
export async function addRun(username: string, duration_ms: number) {
  await sql/*sql*/`
    insert into runs (username, duration_ms)
    values (${username}, ${duration_ms})
  `;
}

/**
 * Update a run record by ID. No-op if no valid fields provided.
 */
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

/**
 * Delete a run by ID.
 */
export async function deleteRunById(id: number) {
  await sql/*sql*/`delete from runs where id = ${id}`;
}

/**
 * Count how many runs this user has submitted "today"
 * using America/New_York calendar day boundaries.
 *
 * This matches your /api routes which filter with:
 * (created_at AT TIME ZONE 'America/New_York')::date = (now() AT TIME ZONE 'America/New_York')::date
 */
export async function countRunsToday(username: string): Promise<number> {
  const TZ = "America/New_York";
  const rows = await sql/*sql*/`
    select count(*)::int as count
    from runs
    where lower(username) = lower(${username})
      and (created_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date
  `;
  const count = (rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  return count;
}
