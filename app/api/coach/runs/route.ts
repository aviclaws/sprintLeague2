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

// You may keep POST for other tooling, but the coach page won't need it anymore.
// export async function POST(...) { /* optional / no longer used by UI */ }

export async function PATCH(req: Request) {
  try {
    await requireRole(["coach"]);
    const raw = await req.json();

    // Coerce and sanitize inputs (handles string ids from BIGINT, etc.)
    const id = raw?.id !== undefined && raw?.id !== null ? Number(raw.id) : NaN;
    const username =
      typeof raw?.username === "string" && raw.username.trim() ? raw.username.trim() : undefined;
    const duration_ms =
      raw?.duration_ms !== undefined && raw?.duration_ms !== null
        ? Number(raw.duration_ms)
        : undefined;

    // INSERT when there's no valid id but we have username + duration_ms
    if (!Number.isFinite(id)) {
      if (typeof username === "string" && Number.isFinite(duration_ms) && (duration_ms as number) > 0) {
        await addRun(username, duration_ms as number);
        return NextResponse.json({ ok: true, mode: "insert" });
      }
      return NextResponse.json(
        { error: "for insert: username and positive duration_ms required" },
        { status: 400 }
      );
    }

    // UPDATE when id is present (optionally username and/or duration_ms)
    const fields: { username?: string; duration_ms?: number } = {};
    if (typeof username === "string") fields.username = username;
    if (Number.isFinite(duration_ms)) fields.duration_ms = duration_ms as number;

    if (!("username" in fields) && !("duration_ms" in fields)) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    await updateRunById(id, fields);
    return NextResponse.json({ ok: true, mode: "update" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireRole(["coach"]);
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
