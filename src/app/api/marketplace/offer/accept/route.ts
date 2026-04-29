import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { offers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/offer/accept
 *
 * Mark an offer as accepted after on-chain fulfillment.
 *
 * Body: { offerId: string, txHash: string }
 */
export async function POST(request: NextRequest) {
  let db;
  try {
    db = getDb();
  } catch {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { offerId, txHash } = body;

    if (!offerId || typeof offerId !== "string") {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }
    if (!txHash || typeof txHash !== "string") {
      return NextResponse.json({ error: "txHash is required" }, { status: 400 });
    }

    // Validate txHash format (0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid txHash format" }, { status: 400 });
    }

    // Only update if the offer is currently active
    await db
      .update(offers)
      .set({ status: "accepted" })
      .where(
        and(
          eq(offers.offerId, offerId),
          eq(offers.status, "active")
        )
      );

    return NextResponse.json({ success: true, offerId, txHash });
  } catch (error) {
    console.error("Error accepting offer:", error);
    return NextResponse.json(
      { error: "Failed to accept offer" },
      { status: 500 }
    );
  }
}
