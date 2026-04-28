import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { listings, listingToppings } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getAllToppings } from "@/lib/toppings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const collection = searchParams.get("collection"); // slug filter
    const topping = searchParams.get("topping"); // topping SKU
    const rarity = searchParams.get("rarity"); // rarity filter
    const toppingClass = searchParams.get("class"); // topping class filter (Cheese, Meat, etc.)

    let db: ReturnType<typeof getDb>;
    try {
      db = getDb();
    } catch {
      // No DATABASE_URL — return empty result gracefully
      return NextResponse.json({
        floor: null,
        currency: "ETH",
        count: 0,
        listing: null,
      });
    }

    // Base condition: only active listings
    const conditions = [eq(listings.status, "active")];

    if (collection) {
      conditions.push(eq(listings.collection, collection));
    }

    // If filtering by topping, rarity, or class, find matching order IDs via listing_toppings
    if (topping || rarity || toppingClass) {
      const toppingConditions = [];

      if (topping) {
        toppingConditions.push(
          eq(listingToppings.toppingSku, Number(topping))
        );
      }

      if (rarity) {
        toppingConditions.push(eq(listingToppings.rarity, rarity));
      }

      if (toppingClass) {
        // Find all SKUs belonging to this class
        const allToppings = getAllToppings();
        const classSKUs = allToppings
          .filter(
            (t) => t.class.toLowerCase() === toppingClass.toLowerCase()
          )
          .map((t) => t.sku);

        if (classSKUs.length === 0) {
          return NextResponse.json({
            floor: null,
            currency: "ETH",
            count: 0,
            listing: null,
          });
        }

        toppingConditions.push(
          inArray(listingToppings.toppingSku, classSKUs)
        );
      }

      const matchingOrderIds = await db
        .select({ orderId: listingToppings.orderId })
        .from(listingToppings)
        .where(
          toppingConditions.length > 1
            ? and(...toppingConditions)
            : toppingConditions[0]
        );

      const orderIds = [
        ...new Set(matchingOrderIds.map((r) => r.orderId)),
      ];

      if (orderIds.length === 0) {
        return NextResponse.json({
          floor: null,
          currency: "ETH",
          count: 0,
          listing: null,
        });
      }

      conditions.push(inArray(listings.orderId, orderIds));
    }

    const whereClause = and(...conditions);

    // Get aggregate floor + count
    const aggResult = await db
      .select({
        floor: sql<string>`MIN(CAST(${listings.price} AS NUMERIC))`,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(whereClause);

    const floor = aggResult[0]?.floor ?? null;
    const count = Number(aggResult[0]?.count ?? 0);

    if (!floor || count === 0) {
      return NextResponse.json({
        floor: null,
        currency: "ETH",
        count: 0,
        listing: null,
      });
    }

    // Find the actual cheapest listing to return its details
    const cheapest = await db
      .select({
        orderId: listings.orderId,
        tokenId: listings.tokenId,
        collection: listings.collection,
        tokenContract: listings.tokenContract,
        chainId: listings.chainId,
        seller: listings.seller,
        price: listings.price,
        currency: listings.currency,
      })
      .from(listings)
      .where(whereClause)
      .orderBy(sql`CAST(${listings.price} AS NUMERIC)`)
      .limit(1);

    const cheapestListing = cheapest[0] || null;

    // Format floor price from wei to ETH
    const floorWei = BigInt(String(floor).split(".")[0]); // strip any decimal
    const floorEth = Number(floorWei) / 1e18;
    const floorFormatted =
      floorEth < 0.001 ? "<0.001" : floorEth.toFixed(floorEth < 1 ? 4 : 3);

    return NextResponse.json({
      floor: floorFormatted,
      floorWei: String(floorWei),
      currency: cheapestListing?.currency || "ETH",
      count,
      listing: cheapestListing,
    });
  } catch (error) {
    console.error("Error fetching floor price:", error);
    return NextResponse.json(
      {
        floor: null,
        currency: "ETH",
        count: 0,
        listing: null,
        error: "Failed to fetch floor price",
      },
      { status: 500 }
    );
  }
}
