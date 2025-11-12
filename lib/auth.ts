// lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";

export type Role = "player" | "coach";
export type Team = "Blue" | "White" | null;

type Session = { sub: string; role: Role; team: Team };

function verifyToken(token: string): Session {
  const secret = process.env.JWT_SECRET!;
  const payload = jwt.verify(token, secret) as any;

  // Normalize everything to lowercase / proper casing
  const rawRole = String(payload.role || "").toLowerCase();
  const role: Role = rawRole === "coach" ? "coach" : "player";

  const team =
    payload.team === "Blue"
      ? "Blue"
      : payload.team === "White"
      ? "White"
      : null;

  return {
    sub: String(payload.sub),
    role,
    team,
  };
}

// Read session from cookies (works in App Router & route handlers)
export async function readSession(): Promise<Session | null> {
  // In Next 15+, dynamic request APIs are async. Use await cookies()/headers().
  const c = await cookies();
  const token = c.get("sl_session")?.value;
  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error("unauthorized");
  return s;
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const s = await requireUser();
  // roles like ["coach"] will now match regardless of casing in token
  if (!roles.includes(s.role)) throw new Error("forbidden");
  return s;
}
