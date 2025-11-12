// app/api/coach/list/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUsers } from "@/lib/users";

export async function GET() {
  requireRole(["coach","admin"]);
  const users = getUsers().map(u => ({ username: u.username, role: u.role, team: u.team ?? null }));
  return NextResponse.json({ users });
}
