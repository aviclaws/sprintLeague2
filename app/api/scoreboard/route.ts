// app/api/scoreboard/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function runsPath() {
  return path.join(process.cwd(), "runs.json");
}

export async function GET() {
  const raw = fs.readFileSync(runsPath(), "utf8");
  const { runs } = JSON.parse(raw) as { runs: { team: "Blue"|"White"|null; duration_ms: number }[] };

  const blue = runs.filter(r => r.team === "Blue").reduce((a,b)=>a+b.duration_ms, 0);
  const white = runs.filter(r => r.team === "White").reduce((a,b)=>a+b.duration_ms, 0);

  return NextResponse.json({ blue, white });
}
