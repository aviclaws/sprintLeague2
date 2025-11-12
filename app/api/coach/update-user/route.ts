// app/api/coach/update-user/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUsers, saveUsers } from "@/lib/users";

type Role = "player" | "coach" | "admin";
type Team = "Blue" | "White" | null;

function normTeam(v: unknown): Team {
  const t = String(v ?? "").trim().toLowerCase();
  if (t === "blue") return "Blue";
  if (t === "white") return "White";
  if (t === "" || t === "none" || t === "null") return null;
  return null;
}

function normRole(v: unknown): Role | null {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "player" || r === "coach" || r === "admin") return r;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["coach", "admin"]);
    const { username, role, team } = await req.json();

    if (!username) {
      return NextResponse.json({ error: "username required" }, { status: 400 });
    }

    const users = getUsers();
    const i = users.findIndex(
      (u) => (u.username || "").toLowerCase() === String(username).trim().toLowerCase()
    );
    if (i < 0) return NextResponse.json({ error: "user not found" }, { status: 404 });

    const upd = { ...users[i] };

    if (role !== undefined) {
      const nr = normRole(role);
      if (!nr) return NextResponse.json({ error: "invalid role" }, { status: 400 });
      (upd as any).role = nr;
    }

    if (team !== undefined) {
      (upd as any).team = normTeam(team); // "Blue" | "White" | null (None)
    }

    users[i] = upd;
    saveUsers(users);

    return NextResponse.json({ ok: true, user: upd });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}
