import { NextResponse } from "next/server";
import { listUsers } from "@/lib/users";
import { requireRole } from "@/lib/auth"; // your existing role-check

export const dynamic = "force-dynamic"; export const revalidate = 0;

export async function GET() {
  await requireRole(["coach"]);        // or ["coach","player"] if you want players to view
  const users = await listUsers();
  return NextResponse.json({ users });
}
