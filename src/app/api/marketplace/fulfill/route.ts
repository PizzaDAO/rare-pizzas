import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/fulfill
 *
 * Marks a listing as "filled" after successful on-chain Seaport fulfillment.
 * Called by the frontend after the buy transaction confirms.
 *
 * Body: { orderId: string, txHash: string }
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
    const { orderId, txHash } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    if (!txHash || typeof txHash !== "string") {
      return NextResponse.json(
        { error: "txHash is required" },
        { status: 400 }
      );
    }

    // Validate txHash format (0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: "Invalid txHash format" },
        { status: 400 }
      );
    }

    // Only update if the listing is currently active
    const result = await db
      .update(listings)
      .set({ status: "filled" })
      .where(and(eq(listings.orderId, orderId), eq(listings.status, "active")));

    return NextResponse.json({
      success: true,
      orderId,
      txHash,
    });
  } catch (error) {
    console.error("Error fulfilling listing:", error);
    return NextResponse.json(
      { error: "Failed to fulfill listing" },
      { status: 500 }
    );
  }
}
