// lib/users.ts
import { getPool } from "./db";

export type Role = "player" | "coach";
export type Team = "Blue" | "White" | null;

export async function listUsers() {
  const db = getPool();
  const { rows } = await db.query(
    `select username, role, team from users order by username asc`
  );
  return rows as { username: string; role: Role; team: Team }[];
}

export async function getUserByUsername(username: string) {
  const db = getPool();
  const { rows } = await db.query(
    `select username, password_hash, role, team from users where lower(username)=lower($1)`,
    [username]
  );
  return rows[0] as
    | { username: string; password_hash: string; role: Role; team: Team }
    | undefined;
}

export async function updateUser(
  username: string,
  changes: { role?: Role; team?: "Blue" | "White" | null }
) {
  const db = getPool();
  if (changes.role !== undefined && changes.team !== undefined) {
    await db.query(
      `update users set role=$2, team=$3 where lower(username)=lower($1)`,
      [username, changes.role, changes.team]
    );
  } else if (changes.role !== undefined) {
    await db.query(
      `update users set role=$2 where lower(username)=lower($1)`,
      [username, changes.role]
    );
  } else if (changes.team !== undefined) {
    await db.query(
      `update users set team=$2 where lower(username)=lower($1)`,
      [username, changes.team]
    );
  }
}

export async function setPasswordHash(username: string, password_hash: string) {
  const db = getPool();
  await db.query(
    `update users set password_hash=$2 where lower(username)=lower($1)`,
    [username, password_hash]
  );
}
