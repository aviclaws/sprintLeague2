import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUsers } from "@/lib/users";

export async function GET() {
  try {
    await requireRole(["coach", "admin"]);
    const users = getUsers().map(u => ({ username: u.username, role: u.role, team: u.team ?? null }));
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "unauthorized", users: [] }, { status: 401 });
  }
}
