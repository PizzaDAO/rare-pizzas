import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/offers
 *
 * Query offers with filters.
 *
 * Query params:
 * - tokenId: filter by specific token
 * - tokenContract: filter by contract address
 * - offerer: filter by offerer address
 * - status: filter by status (default: active)
 * - collection: filter by collection slug
 * - sort: amount-asc, amount-desc, newest (default: newest)
 * - limit: max results (default: 50, max: 100)
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const tokenId = searchParams.get("tokenId");
    const tokenContract = searchParams.get("tokenContract");
    const offerer = searchParams.get("offerer");
    const status = searchParams.get("status") || "active";
    const collection = searchParams.get("collection");
    const sort = searchParams.get("sort") || "newest";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    // Build conditions
    const conditions = [eq(offers.status, status)];

    if (tokenId) {
      conditions.push(eq(offers.tokenId, tokenId));
    }
    if (tokenContract) {
      conditions.push(eq(offers.tokenContract, tokenContract.toLowerCase()));
    }
    if (offerer) {
      conditions.push(eq(offers.offerer, offerer.toLowerCase()));
    }
    if (collection) {
      conditions.push(eq(offers.collection, collection));
    }

    // Sort
    let orderBy;
    switch (sort) {
      case "amount-asc":
        orderBy = asc(sql`CAST(${offers.amount} AS NUMERIC)`);
        break;
      case "amount-desc":
        orderBy = desc(sql`CAST(${offers.amount} AS NUMERIC)`);
        break;
      case "newest":
      default:
        orderBy = desc(offers.createdAt);
        break;
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(offers)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated results
    const results = await db
      .select()
      .from(offers)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ offers: results, total });
  } catch (error) {
    console.error("Error fetching offers:", error);
    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}
