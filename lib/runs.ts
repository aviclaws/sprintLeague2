// lib/runs.ts
import { getPool } from "./db";
import type { Team } from "./users";

export async function listRuns() {
  const db = getPool();
  // include team at run-time by joining current users.team
  const { rows } = await db.query(
    `select r.id, r.username, u.team, r.duration_ms, r.created_at
       from runs r
       left join users u on lower(u.username)=lower(r.username)
     order by r.created_at desc`
  );
  return rows as { id: number; username: string; team: Team; duration_ms: number; created_at: string }[];
}

export async function addRun(username: string, duration_ms: number) {
  const db = getPool();
  await db.query(
    `insert into runs (username, duration_ms) values ($1, $2)`,
    [username, duration_ms]
  );
}

export async function updateRunById(id: number, fields: { username?: string; duration_ms?: number }) {
  const db = getPool();
  if (fields.username !== undefined && fields.duration_ms !== undefined) {
    await db.query(
      `update runs set username=$2, duration_ms=$3 where id=$1`,
      [id, fields.username, fields.duration_ms]
    );
  } else if (fields.username !== undefined) {
    await db.query(`update runs set username=$2 where id=$1`, [id, fields.username]);
  } else if (fields.duration_ms !== undefined) {
    await db.query(`update runs set duration_ms=$2 where id=$1`, [id, fields.duration_ms]);
  }
}

export async function deleteRunById(id: number) {
  const db = getPool();
  await db.query(`delete from runs where id=$1`, [id]);
}
