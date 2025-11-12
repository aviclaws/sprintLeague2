// lib/auth.ts
import { headers } from "next/headers";

export type SessionUser = {
  sub: string;
  role: "player" | "coach" | "admin";
  team?: "Blue" | "White" | null;
};

export function requireUser(): SessionUser {
  const h = headers().get("x-user");
  if (!h) throw new Error("Unauthorized");
  return JSON.parse(h) as SessionUser;
}

export function requireRole(roles: SessionUser["role"][]) {
  const user = requireUser();
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}
