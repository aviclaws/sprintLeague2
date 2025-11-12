import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { updateUser, getUserByUsername } from "@/lib/users";

export const dynamic = "force-dynamic"; export const revalidate = 0;

export async function POST(req: NextRequest) {
  await requireRole(["coach"]);
  const { username, role, team } = await req.json();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const changes: any = {};
  if (role !== undefined) {
    if (role !== "player" && role !== "coach")
      return NextResponse.json({ error: "invalid role" }, { status: 400 });
    changes.role = role;
  }
  if (team !== undefined) {
    if (team === "Bench" || team === null) changes.team = null;
    else if (team === "Blue" || team === "White") changes.team = team;
    else return NextResponse.json({ error: "invalid team" }, { status: 400 });
  }

  await updateUser(username, changes);
  const user = await getUserByUsername(username);
  return NextResponse.json({ ok: true, user: { username: user!.username, role: user!.role, team: user!.team } });
}
