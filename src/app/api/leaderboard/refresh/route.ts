import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leaderboardSnapshots } from "@/db/schema";
import { runSnapshot } from "@/lib/leaderboard-ingestion";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const secret = process.env.LEADERBOARD_REFRESH_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    // Check for running snapshots
    const [running] = await db
      .select()
      .from(leaderboardSnapshots)
      .where(eq(leaderboardSnapshots.status, "running"))
      .limit(1);

    if (running) {
      return NextResponse.json(
        {
          error: "A snapshot is already running",
          snapshotId: running.id,
          startedAt: running.startedAt,
        },
        { status: 409 }
      );
    }

    const snapshotId = await runSnapshot(db);

    return NextResponse.json({ success: true, snapshotId });
  } catch (error) {
    console.error("[leaderboard] refresh error:", error);
    return NextResponse.json(
      { error: "Snapshot failed" },
      { status: 500 }
    );
  }
}
