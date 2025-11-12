import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getUserByUsername, updateUser, type Team } from "@/lib/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    // Only coaches can change teams
    await requireRole(["coach"]);

    const { username, team } = (await req.json()) as {
      username: string;
      team: Team; // "Blue" | "White" | null
    };

    if (!username || team == null) {
      return NextResponse.json(
        { error: "username and team required" },
        { status: 400 }
      );
    }
    if (team !== "Blue" && team !== "White") {
      return NextResponse.json(
        { error: "team must be 'Blue' or 'White'" },
        { status: 400 }
      );
    }

    // Ensure the user exists first (clear 404 if not)
    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await updateUser(username, { team }); // uses the DB-backed helper
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // If requireRole throws, treat as unauthorized
    return NextResponse.json(
      { error: err?.message ?? "unauthorized" },
      { status: 401 }
    );
  }
}
