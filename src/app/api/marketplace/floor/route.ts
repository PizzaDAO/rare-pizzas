import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { listings, listingToppings } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const collection = searchParams.get("collection"); // slug filter
    const topping = searchParams.get("topping"); // topping SKU
    const rarity = searchParams.get("rarity"); // rarity filter

    // Base condition: only active listings
    const conditions = [eq(listings.status, "active")];

    if (collection) {
      conditions.push(eq(listings.collection, collection));
    }

    // If filtering by topping or rarity, find matching order IDs
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

      const orderIds = matchingOrderIds.map((r) => r.orderId);

      if (orderIds.length === 0) {
        return NextResponse.json({ floor: null, count: 0 });
      }

      conditions.push(inArray(listings.orderId, orderIds));
    }

    const whereClause = and(...conditions);

    const result = await db
      .select({
        floor: sql<string>`MIN(CAST(${listings.price} AS NUMERIC))`,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .where(whereClause);

    const floor = result[0]?.floor ?? null;
    const count = Number(result[0]?.count ?? 0);

    return NextResponse.json({
      floor: floor ? String(floor) : null,
      count,
    });
  } catch (error) {
    console.error("Error fetching floor price:", error);
    return NextResponse.json(
      { error: "Failed to fetch floor price" },
      { status: 500 }
    );
  }
}
