// app/api/runs/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { getUsers } from "@/lib/users";

function runsPath() {
  return path.join(process.cwd(), "runs.json");
}

type Run = {
  username: string;
  team: "Blue" | "White" | null;
  sprint: number;
  duration_ms: number;
  created_at: string;
};

type RunsFile = { runs: Run[] };

export async function POST(req: NextRequest) {
  const user = requireUser();
  const body = await req.json() as { start: number; stop: number; sprint?: number };
  const sprint = body.sprint ?? 1;

  if (typeof body.start !== "number" || typeof body.stop !== "number" || body.stop <= body.start) {
    return NextResponse.json({ error: "Invalid timestamps" }, { status: 400 });
  }

  const duration_ms = Math.round(body.stop - body.start);
  if (duration_ms < 200 || duration_ms > 10 * 60 * 1000) {
    return NextResponse.json({ error: "Unreasonable time" }, { status: 400 });
  }

  const users = getUsers();
  const me = users.find(u => u.username === user.sub);
  const team = me?.team ?? null;

  const raw = fs.readFileSync(runsPath(), "utf8");
  const data = JSON.parse(raw) as RunsFile;

  data.runs.push({
    username: user.sub,
    team: (team as any) ?? null,
    sprint,
    duration_ms,
    created_at: new Date().toISOString()
  });

  fs.writeFileSync(runsPath(), JSON.stringify(data, null, 2));

  return NextResponse.json({ ok: true, duration_ms });
}
