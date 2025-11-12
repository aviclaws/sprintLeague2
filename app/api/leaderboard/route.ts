// app/api/leaderboard/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type Run = {
  username: string;
  team?: "Blue" | "White" | null;
  duration_ms: number;
  created_at: string;
};

function runsPath() {
  return path.join(process.cwd(), "runs.json");
}

export async function GET() {
  try {
    if (!fs.existsSync(runsPath())) {
      return NextResponse.json({ rows: [] });
    }

    const { runs } = JSON.parse(fs.readFileSync(runsPath(), "utf8")) as { runs: Run[] };
    if (!Array.isArray(runs)) return NextResponse.json({ rows: [] });

    // Sort fastest → slowest first (so scoreboard stays consistent)
    const sorted = [...runs].sort((a, b) => (a.duration_ms ?? 0) - (b.duration_ms ?? 0));

    // compute per-user indices
    const counters: Record<string, number> = {};
    const rows = sorted.map((r) => {
      const uname = (r.username ?? "").trim().toLowerCase();
      counters[uname] = (counters[uname] ?? 0) + 1;
      return {
        index: counters[uname], // unique per user
        username: r.username,
        team: r.team ?? "—",
        duration_ms: r.duration_ms,
        created_at: r.created_at,
      };
    });

    return new NextResponse(JSON.stringify({ rows }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ rows: [], error: err?.message ?? "Server error" }, { status: 500 });
  }
}
