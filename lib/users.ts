// lib/users.ts
import fs from "fs";
import path from "path";

export type Role = "player" | "coach" | "admin";
export type Team = "Blue" | "White";

export type AppUser = {
  username: string;
  password_hash: string;   // bcrypt hash (or plaintext if you insist)
  role: Role;
  team?: Team;
};

type UsersFile = { users: AppUser[] };

function usersPath() {
  return path.join(process.cwd(), "users.json");
}

export function getUsers(): AppUser[] {
  const raw = fs.readFileSync(usersPath(), "utf8");
  const data = JSON.parse(raw) as UsersFile;
  return data.users;
}

export function findUser(username: string) {
  return getUsers().find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );
}

// For local/dev only: overwrite users.json to change teams, etc.
export function saveUsers(users: AppUser[]) {
  const data: UsersFile = { users };
  fs.writeFileSync(usersPath(), JSON.stringify(data, null, 2));
}
