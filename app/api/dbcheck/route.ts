// app/api/dbcheck/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export async function GET() {
  try {
    const start = Date.now();
    const rows = await sql/*sql*/`select 1 as ok`;
    return NextResponse.json({ ok: rows[0].ok, ms: Date.now() - start });
  } catch (e: any) {
    console.error("[dbcheck] error", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
