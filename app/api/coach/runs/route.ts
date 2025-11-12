import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listRuns, addRun, updateRunById, deleteRunById } from "@/lib/runs";

export const dynamic = "force-dynamic"; export const revalidate = 0;

export async function GET() {
  await requireRole(["coach"]);
  const rows = await listRuns(); // includes team joined from users
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  await requireRole(["coach"]);
  const { username, duration_ms } = await req.json();
  if (!username || !Number.isFinite(duration_ms) || duration_ms <= 0)
    return NextResponse.json({ error: "username & positive duration_ms required" }, { status: 400 });
  await addRun(username, Math.round(duration_ms));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  await requireRole(["coach"]);
  const { id, username, duration_ms } = await req.json();
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const fields: any = {};
  if (username !== undefined) fields.username = username;
  if (duration_ms !== undefined) {
    if (!Number.isFinite(duration_ms) || duration_ms <= 0)
      return NextResponse.json({ error: "duration_ms > 0 required" }, { status: 400 });
    fields.duration_ms = Math.round(duration_ms);
  }
  await updateRunById(Number(id), fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await requireRole(["coach"]);
  const { id } = await req.json();
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteRunById(Number(id));
  return NextResponse.json({ ok: true });
}
