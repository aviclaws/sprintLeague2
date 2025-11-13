import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addRun, countRunsToday } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SPRINTS = 10;

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const { start, stop } = await req.json();

  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) {
    return NextResponse.json({ error: "bad timestamps" }, { status: 400 });
  }

  const duration_ms = Math.max(0, Math.round(stop - start));
  if (duration_ms < 50 || duration_ms > 10 * 60_000) {
    return NextResponse.json({ error: "unreasonable time" }, { status: 400 });
  }

  // Enforce daily max (1..10)
  // NOTE: implement countRunsToday(userId) in your data layer to count
  // runs created "today" for this user (define "today" consistently).
  const priorCount = await countRunsToday(user.sub);
  if (priorCount >= MAX_SPRINTS) {
    return NextResponse.json({ error: "Daily limit reached (10/10)" }, { status: 400 });
  }

  const sprint_index = priorCount + 1; // 1..10

  // If your addRun signature can accept an index, pass it; otherwise ignore
  // and rely on created_at ordering for rendering (client already handles sequential slots).
  // Example: addRun(userId, duration_ms, sprint_index)
  await addRun(user.sub, duration_ms /* , sprint_index */);

  return NextResponse.json({ ok: true, sprint_index });
}
