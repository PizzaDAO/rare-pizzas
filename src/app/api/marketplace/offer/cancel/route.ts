import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/offer/cancel
 *
 * Cancel an offer. Updates status to "cancelled".
 *
 * Body: { offerId: string, offerer: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, offerer } = body;

    if (!offerId || typeof offerId !== "string") {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }
    if (!offerer || typeof offerer !== "string") {
      return NextResponse.json({ error: "offerer is required" }, { status: 400 });
    }

    // Only cancel if the offer belongs to the offerer and is active
    await db
      .update(offers)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(offers.offerId, offerId),
          eq(offers.offerer, offerer.toLowerCase()),
          eq(offers.status, "active")
        )
      );

    return NextResponse.json({ success: true, offerId });
  } catch (error) {
    console.error("Error cancelling offer:", error);
    return NextResponse.json(
      { error: "Failed to cancel offer" },
      { status: 500 }
    );
  }
}
