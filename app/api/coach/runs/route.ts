// app/api/coach/runs/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listRuns, addRun, updateRunById, deleteRunById } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireRole(["coach"]);
    const rows = await listRuns();
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["coach"]);
    const { username, duration_ms } = await req.json();
    if (!username || !(Number.isFinite(duration_ms) && duration_ms > 0)) {
      return NextResponse.json({ error: "username and positive duration_ms required" }, { status: 400 });
    }
    await addRun(String(username), Number(duration_ms));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireRole(["coach"]);
    const { id, username, duration_ms } = await req.json();
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const fields: { username?: string; duration_ms?: number } = {};
    if (typeof username === "string" && username.trim()) fields.username = username.trim();
    if (Number.isFinite(duration_ms)) fields.duration_ms = Number(duration_ms);
    if (!("username" in fields) && !("duration_ms" in fields)) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    await updateRunById(Number(id), fields);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireRole(["coach"]);

    // Prefer query param (?id=123), fall back to JSON body
    const url = new URL(req.url);
    const qsId = url.searchParams.get("id");
    let id: number | null = qsId ? Number(qsId) : null;

    if (!Number.isFinite(id)) {
      try {
        const body = await req.json();
        if (Number.isFinite(body?.id)) id = Number(body.id);
      } catch { /* no body */ }
    }

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await deleteRunById(id as number);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}
