// lib/auth.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export type SessionUser = {
  sub: string;
  role: "player" | "coach" | "admin";
  team?: "Blue" | "White" | null;
};

export async function requireUser(): Promise<SessionUser> {
  const store = await cookies();
  const raw = store.get("sl_session")?.value;
  if (!raw) throw new Error("Unauthorized");
  const payload = jwt.verify(raw, process.env.JWT_SECRET!) as SessionUser;
  return payload;
}

export async function requireRole(roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new Error("Forbidden");
  return u;
}
