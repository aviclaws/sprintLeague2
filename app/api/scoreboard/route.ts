// app/api/scoreboard/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUsers } from "@/lib/users";

type Run = { username?: string; duration_ms?: number };

function runsPath() {
  return path.join(process.cwd(), "runs.json");
}

function normUser(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

function normTeam(s: unknown): "Blue" | "White" | null {
  const t = String(s ?? "").trim().toLowerCase();
  if (t === "blue") return "Blue";
  if (t === "white") return "White";
  return null;
}

export async function GET(req: Request) {
  // Build username -> CURRENT team map from users.json (normalized)
  const users = getUsers();
  const teamOf: Record<string, "Blue" | "White" | null> = {};
  for (const u of users) {
    teamOf[normUser(u.username)] = normTeam((u as any).team);
  }

  // Load runs safely
  let runs: Run[] = [];
  try {
    if (fs.existsSync(runsPath())) {
      const raw = fs.readFileSync(runsPath(), "utf8");
      runs = (JSON.parse(raw)?.runs ?? []) as Run[];
    }
  } catch {
    runs = [];
  }

  // Sum durations by CURRENT team (case/space insensitive)
  let blue = 0;
  let white = 0;

  // For optional diagnostics
  const url = new URL(req.url);
  const wantDebug = url.searchParams.get("debug") === "1";
  const perUser: Record<string, number> = {};
  const unknownUsers: string[] = [];

  for (const r of runs) {
    const uname = normUser(r.username);
    const ms = Number(r.duration_ms);
    if (!uname || !Number.isFinite(ms) || ms < 0) continue;

    const team = teamOf[uname] ?? null;
    if (team === "Blue") blue += ms;
    else if (team === "White") white += ms;
    else if (wantDebug) unknownUsers.push(uname);

    if (wantDebug) perUser[uname] = (perUser[uname] || 0) + ms;
  }

  const body: any = { blue, white };

  if (wantDebug) {
    body.debug = {
      users_mapped: Object.keys(teamOf).length,
      blueUsers: Object.entries(teamOf).filter(([, t]) => t === "Blue").map(([u]) => u),
      whiteUsers: Object.entries(teamOf).filter(([, t]) => t === "White").map(([u]) => u),
      unknownUsers, // runs whose usernames don’t map to a team
      totalsByUser: perUser,
    };
  }

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
