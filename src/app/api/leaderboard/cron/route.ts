import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { runSnapshot } from "@/lib/leaderboard-ingestion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const snapshotId = await runSnapshot(db);

    return NextResponse.json({ ok: true, snapshotId });
  } catch (error) {
    console.error("[leaderboard] cron error:", error);
    return NextResponse.json(
      { error: "Cron snapshot failed" },
      { status: 500 }
    );
  }
}
