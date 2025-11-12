// app/api/runs/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { getUsers } from "@/lib/users";

type Team = "Blue" | "White" | null;
type Run = { username: string; team: Team; duration_ms: number; created_at: string };

function runsPath() {
  return path.join(process.cwd(), "runs.json");
}

function loadRuns(): { runs: Run[] } {
  const p = runsPath();
  if (!fs.existsSync(p)) return { runs: [] };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { runs: [] };
  }
}

function saveRuns(data: { runs: Run[] }) {
  fs.writeFileSync(runsPath(), JSON.stringify(data, null, 2));
}

export async function POST(req: NextRequest) {
  const user = await requireUser(); // async version
  const { start, stop } = await req.json();

  if (typeof start !== "number" || typeof stop !== "number" || !isFinite(start) || !isFinite(stop) || stop <= start) {
    return NextResponse.json({ error: "Invalid timestamps" }, { status: 400 });
  }

  const duration_ms = Math.max(0, Math.round(stop - start));
  if (duration_ms < 50 || duration_ms > 10 * 60 * 1000) {
    return NextResponse.json({ error: "Unreasonable time" }, { status: 400 });
  }

  // Look up team from users.json at submission time
  const me = getUsers().find(u => u.username === user.sub);
  const team: Team = (me?.team === "Blue" || me?.team === "White") ? me!.team : null;

  const data = loadRuns();
  data.runs.push({
    username: user.sub,
    team,
    duration_ms,
    created_at: new Date().toISOString(),
  });
  saveRuns(data);

  return NextResponse.json({ ok: true, duration_ms });
}
