import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { offers } from "@/db/schema";
import { crossPostOfferToOpenSea } from "@/lib/opensea-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/offer
 *
 * Store a new signed Seaport offer order.
 *
 * Body: {
 *   offerId: string,
 *   orderData: object (signed Seaport offer order),
 *   collection: string (slug),
 *   tokenContract: string,
 *   chainId: number,
 *   tokenId: string | null (null for collection-wide offers),
 *   offerer: string,
 *   amount: string (wei),
 *   currency: string,
 *   expiry: string (ISO timestamp)
 * }
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
    const {
      offerId,
      orderData,
      collection,
      tokenContract,
      chainId,
      tokenId,
      offerer,
      amount,
      currency,
      expiry,
    } = body;

    // Validate required fields
    if (!offerId || typeof offerId !== "string") {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }
    if (!orderData || typeof orderData !== "object") {
      return NextResponse.json({ error: "orderData is required" }, { status: 400 });
    }
    if (!collection || typeof collection !== "string") {
      return NextResponse.json({ error: "collection is required" }, { status: 400 });
    }
    if (!tokenContract || typeof tokenContract !== "string") {
      return NextResponse.json({ error: "tokenContract is required" }, { status: 400 });
    }
    if (!chainId || typeof chainId !== "number") {
      return NextResponse.json({ error: "chainId is required" }, { status: 400 });
    }
    if (!offerer || typeof offerer !== "string") {
      return NextResponse.json({ error: "offerer is required" }, { status: 400 });
    }
    if (!amount || typeof amount !== "string") {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }
    if (!currency || typeof currency !== "string") {
      return NextResponse.json({ error: "currency is required" }, { status: 400 });
    }
    if (!expiry || typeof expiry !== "string") {
      return NextResponse.json({ error: "expiry is required" }, { status: 400 });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(offerer)) {
      return NextResponse.json({ error: "Invalid offerer address" }, { status: 400 });
    }

    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }

    await db.insert(offers).values({
      offerId,
      orderData,
      collection,
      tokenContract: tokenContract.toLowerCase(),
      chainId,
      tokenId: tokenId || null,
      offerer: offerer.toLowerCase(),
      amount,
      currency,
      expiry: expiryDate,
      status: "active",
    });

    // Cross-post to OpenSea (fire-and-forget — don't block the response)
    crossPostOfferToOpenSea(
      chainId,
      orderData as { parameters: Record<string, unknown>; signature: string },
      "0x0000000000000068F116a894984e2DB1123eB395" // Seaport 1.6
    ).catch((err) => console.error("[offer] OpenSea cross-post error:", err));

    return NextResponse.json({
      success: true,
      offerId,
      collection,
      tokenId,
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    );
  }
}
