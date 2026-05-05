import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { ingestActivityEvents } from "@/lib/activity-ingestion";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backfill = request.nextUrl.searchParams.get("backfill") === "true";
    const db = getDb();
    const result = await ingestActivityEvents(db, backfill);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[activity] cron error:", error);
    return NextResponse.json(
      { error: "Activity cron failed" },
      { status: 500 }
    );
  }
}
