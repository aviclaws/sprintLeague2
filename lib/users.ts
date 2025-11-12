// lib/users.ts
import { sql } from "./db";
export type Role = "player" | "coach";
export type Team = "Blue" | "White" | null;

export async function listUsers() {
  const rows = await sql/*sql*/`
    select username, lower(role) as role, team
    from users
    order by username asc`;
  return rows as { username: string; role: Role; team: Team }[];
}

export async function getUserByUsername(username: string) {
  const rows = await sql/*sql*/`
    select username, password_hash, lower(role) as role, team
    from users
    where lower(username) = lower(${username})
    limit 1`;
  return (rows[0] as
    | { username: string; password_hash: string; role: Role; team: Team }
    | undefined);
}

export async function updateUser(
  username: string,
  changes: { role?: Role; team?: Team }
) {
  // Normalize role casing
  const role =
    changes.role !== undefined ? (changes.role.toLowerCase() as Role) : undefined;

  if (role !== undefined && changes.team !== undefined) {
    await sql/*sql*/`
      update users
      set role = lower(${role}), team = ${changes.team}
      where lower(username) = lower(${username})
    `;
  } else if (role !== undefined) {
    await sql/*sql*/`
      update users
      set role = lower(${role})
      where lower(username) = lower(${username})
    `;
  } else if (changes.team !== undefined) {
    await sql/*sql*/`
      update users
      set team = ${changes.team}
      where lower(username) = lower(${username})
    `;
  }
}

export async function setPasswordHash(username: string, password_hash: string) {
  await sql/*sql*/`
    update users set password_hash=${password_hash}
    where lower(username)=lower(${username})`;
}
