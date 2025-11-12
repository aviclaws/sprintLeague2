// app/api/coach/set-team/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUsers, saveUsers, AppUser, Team } from "@/lib/users";

export async function POST(req: NextRequest) {
  requireRole(["coach", "admin"]);
  const { username, team } = await req.json() as { username: string; team: Team };
  if (!username || !team) {
    return NextResponse.json({ error: "username and team required" }, { status: 400 });
  }
  const users = getUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updated: AppUser = { ...users[idx], team };
  users[idx] = updated;
  // NOTE: writing to disk works locally. On many free hosts, this won't persist.
  saveUsers(users);

  return NextResponse.json({ ok: true, user: updated });
}
