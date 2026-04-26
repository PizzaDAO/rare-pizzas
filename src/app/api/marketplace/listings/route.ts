import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { listings, listingToppings } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const collection = searchParams.get("collection"); // slug filter
    const topping = searchParams.get("topping"); // topping SKU
    const rarity = searchParams.get("rarity"); // rarity filter
    const priceMin = searchParams.get("priceMin"); // min price in wei
    const priceMax = searchParams.get("priceMax"); // max price in wei
    const chain = searchParams.get("chain"); // chain ID
    const sort = searchParams.get("sort") || "newest"; // price-asc, price-desc, rarity, newest
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    // Build conditions
    const conditions = [eq(listings.status, "active")];

    if (collection) {
      conditions.push(eq(listings.collection, collection));
    }

    if (chain) {
      conditions.push(eq(listings.chainId, Number(chain)));
    }

    if (priceMin) {
      conditions.push(gte(listings.price, priceMin));
    }

    if (priceMax) {
      conditions.push(lte(listings.price, priceMax));
    }

    // If filtering by topping, we need a subquery to find matching order IDs
    let orderIdFilter: string[] | null = null;

    if (topping || rarity) {
      const toppingConditions = [];
      if (topping) {
        toppingConditions.push(eq(listingToppings.toppingSku, Number(topping)));
      }
      if (rarity) {
        toppingConditions.push(eq(listingToppings.rarity, rarity));
      }

      const matchingOrderIds = await db
        .select({ orderId: listingToppings.orderId })
        .from(listingToppings)
        .where(and(...toppingConditions));

      orderIdFilter = matchingOrderIds.map((r) => r.orderId);

      if (orderIdFilter.length === 0) {
        return NextResponse.json({ listings: [], total: 0 });
      }

      conditions.push(inArray(listings.orderId, orderIdFilter));
    }

    // Determine sort order
    let orderBy;
    switch (sort) {
      case "price-asc":
        orderBy = asc(sql`CAST(${listings.price} AS NUMERIC)`);
        break;
      case "price-desc":
        orderBy = desc(sql`CAST(${listings.price} AS NUMERIC)`);
        break;
      case "newest":
      default:
        orderBy = desc(listings.createdAt);
        break;
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(listings)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated listings
    const results = await db
      .select()
      .from(listings)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Fetch toppings for each listing
    const listingOrderIds = results.map((l) => l.orderId);
    let toppingsMap: Record<string, Array<{ toppingSku: number; rarity: string }>> = {};

    if (listingOrderIds.length > 0) {
      const toppingsResult = await db
        .select()
        .from(listingToppings)
        .where(inArray(listingToppings.orderId, listingOrderIds));

      for (const t of toppingsResult) {
        if (!toppingsMap[t.orderId]) {
          toppingsMap[t.orderId] = [];
        }
        toppingsMap[t.orderId].push({
          toppingSku: t.toppingSku,
          rarity: t.rarity,
        });
      }
    }

    // Combine listings with their toppings
    const enrichedListings = results.map((listing) => ({
      ...listing,
      toppings: toppingsMap[listing.orderId] || [],
    }));

    return NextResponse.json({
      listings: enrichedListings,
      total,
    });
  } catch (error) {
    console.error("Error fetching listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}
