import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/cancel
 *
 * Mark a listing as cancelled. Called after on-chain Seaport cancel tx.
 *
 * Body: { orderId: string, seller: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, seller } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }
    if (!seller || typeof seller !== "string") {
      return NextResponse.json({ error: "seller is required" }, { status: 400 });
    }

    // Only cancel if the listing belongs to the seller and is active
    const result = await db
      .update(listings)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(listings.orderId, orderId),
          eq(listings.seller, seller.toLowerCase()),
          eq(listings.status, "active")
        )
      );

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error("Error cancelling listing:", error);
    return NextResponse.json(
      { error: "Failed to cancel listing" },
      { status: 500 }
    );
  }
}
