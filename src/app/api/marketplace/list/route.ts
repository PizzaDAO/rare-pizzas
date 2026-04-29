import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { listings, listingToppings } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/list
 *
 * Store a new signed Seaport listing order.
 *
 * Body: {
 *   orderId: string,
 *   orderData: object (signed Seaport order),
 *   collection: string (slug),
 *   tokenContract: string,
 *   chainId: number,
 *   tokenId: string,
 *   seller: string,
 *   price: string (wei),
 *   currency: string,
 *   expiry: string (ISO timestamp),
 *   toppings: Array<{ sku: number, rarity: string }>
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
      orderId,
      orderData,
      collection,
      tokenContract,
      chainId,
      tokenId,
      seller,
      price,
      currency,
      expiry,
      toppings,
    } = body;

    // Validate required fields
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
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
    if (!tokenId || typeof tokenId !== "string") {
      return NextResponse.json({ error: "tokenId is required" }, { status: 400 });
    }
    if (!seller || typeof seller !== "string") {
      return NextResponse.json({ error: "seller is required" }, { status: 400 });
    }
    if (!price || typeof price !== "string") {
      return NextResponse.json({ error: "price is required" }, { status: 400 });
    }
    if (!currency || typeof currency !== "string") {
      return NextResponse.json({ error: "currency is required" }, { status: 400 });
    }
    if (!expiry || typeof expiry !== "string") {
      return NextResponse.json({ error: "expiry is required" }, { status: 400 });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(seller)) {
      return NextResponse.json({ error: "Invalid seller address" }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenContract)) {
      return NextResponse.json({ error: "Invalid tokenContract address" }, { status: 400 });
    }

    const expiryDate = new Date(expiry);
    if (isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }

    // Insert listing
    await db.insert(listings).values({
      orderId,
      orderData,
      collection,
      tokenContract: tokenContract.toLowerCase(),
      chainId,
      tokenId,
      seller: seller.toLowerCase(),
      price,
      currency,
      expiry: expiryDate,
      status: "active",
    });

    // Insert toppings if provided
    if (Array.isArray(toppings) && toppings.length > 0) {
      const toppingRows = toppings
        .filter(
          (t: { sku: number; rarity: string }) =>
            typeof t.sku === "number" && typeof t.rarity === "string"
        )
        .map((t: { sku: number; rarity: string }) => ({
          orderId,
          toppingSku: t.sku,
          rarity: t.rarity,
        }));

      if (toppingRows.length > 0) {
        await db.insert(listingToppings).values(toppingRows);
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      collection,
      tokenId,
    });
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}
