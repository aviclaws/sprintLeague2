// app/api/coach/runs/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireRole } from "@/lib/auth";
import { getUsers } from "@/lib/users";

type Team = "Blue" | "White" | null;
type Run = { username: string; team: Team; duration_ms: number; created_at: string };

function runsPath() { return path.join(process.cwd(), "runs.json"); }

function loadRuns(): { runs: Run[] } {
  const p = runsPath();
  if (!fs.existsSync(p)) return { runs: [] };
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return { runs: [] }; }
}

function saveRuns(data: { runs: Run[] }) {
  fs.writeFileSync(runsPath(), JSON.stringify(data, null, 2));
}

function normUser(s: unknown) { return String(s ?? "").trim().toLowerCase(); }
function normTeam(s: unknown): Team {
  const t = String(s ?? "").trim().toLowerCase();
  if (t === "blue") return "Blue";
  if (t === "white") return "White";
  return null;
}

function currentTeamFor(username: string): Team {
  const users = getUsers();
  const u = users.find(x => normUser(x.username) === normUser(username));
  return normTeam((u as any)?.team);
}

/** GET -> list all runs with index */
export async function GET() {
  try {
    await requireRole(["coach", "admin"]);
    const data = loadRuns();
    const rows = data.runs.map((r, i) => ({
      index: i,
      username: r.username,
      team: r.team,
      duration_ms: r.duration_ms,
      created_at: r.created_at,
    })).reverse(); // newest first
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

/** POST -> add a run { username, duration_ms } */
export async function POST(req: NextRequest) {
  try {
    await requireRole(["coach", "admin"]);
    const { username, duration_ms } = await req.json();
    if (!username || !Number.isFinite(duration_ms) || duration_ms <= 0) {
      return NextResponse.json({ error: "username and positive duration_ms required" }, { status: 400 });
    }
    const data = loadRuns();
    const team = currentTeamFor(username);
    data.runs.push({
      username,
      team,
      duration_ms: Math.round(duration_ms),
      created_at: new Date().toISOString(),
    });
    saveRuns(data);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

/** PATCH -> update a run { index, username?, duration_ms? } */
export async function PATCH(req: NextRequest) {
  try {
    await requireRole(["coach", "admin"]);
    const { index, username, duration_ms } = await req.json();
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "valid index required" }, { status: 400 });
    }
    const data = loadRuns();
    if (index >= data.runs.length) return NextResponse.json({ error: "index out of range" }, { status: 404 });

    const r = { ...data.runs[index] };
    if (username) {
      r.username = username;
      r.team = currentTeamFor(username); // keep team in sync with users.json
    }
    if (duration_ms != null) {
      const ms = Number(duration_ms);
      if (!Number.isFinite(ms) || ms <= 0) return NextResponse.json({ error: "duration_ms must be > 0" }, { status: 400 });
      r.duration_ms = Math.round(ms);
    }
    data.runs[index] = r;
    saveRuns(data);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}

/** DELETE -> delete a run { index } */
export async function DELETE(req: NextRequest) {
  try {
    await requireRole(["coach", "admin"]);
    const { index } = await req.json();
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "valid index required" }, { status: 400 });
    }
    const data = loadRuns();
    if (index >= data.runs.length) return NextResponse.json({ error: "index out of range" }, { status: 404 });
    data.runs.splice(index, 1);
    saveRuns(data);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unauthorized" }, { status: 401 });
  }
}
