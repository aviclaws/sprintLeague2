import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUsers, saveUsers, Team } from "@/lib/users";

export async function POST(req: NextRequest) {
  try {
    await requireRole(["coach", "admin"]);
    const { username, team } = await req.json() as { username: string; team: Team };
    if (!username || !team) return NextResponse.json({ error: "username and team required" }, { status: 400 });

    const users = getUsers();
    const i = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    if (i < 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

    users[i] = { ...users[i], team };
    saveUsers(users);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "unauthorized" }, { status: 401 });
  }
}
