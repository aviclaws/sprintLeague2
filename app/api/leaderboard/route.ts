// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type Run = { username: string; duration_ms: number; sprint: number; created_at: string };

function runsPath() {
  return path.join(process.cwd(), "runs.json");
}

export async function GET() {
  const raw = fs.readFileSync(runsPath(), "utf8");
  const { runs } = JSON.parse(raw) as { runs: Run[] };

  // latest sprint number present (simple heuristic)
  const latestSprint = runs.reduce((max, r) => Math.max(max, r.sprint || 1), 1);

  // best time per user for latest sprint
  const bestByUser = new Map<string, number>();
  runs.filter(r => r.sprint === latestSprint).forEach(r => {
    const best = bestByUser.get(r.username);
    if (best == null || r.duration_ms < best) bestByUser.set(r.username, r.duration_ms);
  });

  const rows = [...bestByUser.entries()]
    .map(([username, duration_ms]) => ({ username, duration_ms, sprint: latestSprint }))
    .sort((a,b)=>a.duration_ms - b.duration_ms)
    .slice(0, 50);

  return NextResponse.json({ sprint: latestSprint, rows });
}
