import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addRun } from "@/lib/runs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  // optional: require auth; remove if you want open inserts
  await requireUser();

  const body = await req.json().catch(() => ({}));
  const { username, duration_ms } = body ?? {};

  if (
    typeof username !== "string" ||
    !username.trim() ||
    !Number.isFinite(duration_ms) ||
    duration_ms <= 0
  ) {
    return NextResponse.json(
      { error: "for insert: username and positive duration_ms required" },
      { status: 400 }
    );
  }

  await addRun(username.trim(), Math.round(duration_ms));
  return NextResponse.json({ ok: true });
}
