import { NextRequest, NextResponse } from "next/server";
import { eq, desc, ilike, or, sql, and } from "drizzle-orm";
import { getDb } from "@/db";
import { leaderboardSnapshots, leaderboardHolders } from "@/db/schema";

export const dynamic = "force-dynamic";

type SortColumn = "total" | "rarity" | "completeness";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const sort = (searchParams.get("sort") || "total") as SortColumn;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;
    const search = searchParams.get("search") || "";

    const db = getDb();

    // Find latest completed snapshot
    const [latestSnapshot] = await db
      .select()
      .from(leaderboardSnapshots)
      .where(eq(leaderboardSnapshots.status, "completed"))
      .orderBy(desc(leaderboardSnapshots.completedAt))
      .limit(1);

    if (!latestSnapshot) {
      return NextResponse.json(
        { holders: [], total: 0, snapshot: null },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60",
          },
        }
      );
    }

    // Determine sort column
    let orderByColumn;
    switch (sort) {
      case "rarity":
        orderByColumn = leaderboardHolders.rankByRarity;
        break;
      case "completeness":
        orderByColumn = leaderboardHolders.rankByCompleteness;
        break;
      default:
        orderByColumn = leaderboardHolders.rankByTotal;
    }

    // Build conditions
    const conditions = [
      eq(leaderboardHolders.snapshotId, latestSnapshot.id),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(leaderboardHolders.ensName, `%${search}%`),
          ilike(leaderboardHolders.wallet, `${search.toLowerCase()}%`)
        )!
      );
    }

    // Query holders
    const holders = await db
      .select()
      .from(leaderboardHolders)
      .where(and(...conditions))
      .orderBy(orderByColumn)
      .limit(limit)
      .offset(offset);

    // Count total matching
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leaderboardHolders)
      .where(and(...conditions));

    return NextResponse.json(
      {
        holders: holders.map((h) => ({
          wallet: h.wallet,
          pizzaCount: h.pizzaCount,
          boxCount: h.boxCount,
          totalNfts: h.totalNfts,
          rarityScore: h.rarityScore,
          uniqueToppings: h.uniqueToppings,
          completenessScore: h.completenessScore,
          ensName: h.ensName,
          ensAvatar: h.ensAvatar,
          rankByTotal: h.rankByTotal,
          rankByRarity: h.rankByRarity,
          rankByCompleteness: h.rankByCompleteness,
        })),
        total: Number(count),
        snapshot: {
          id: latestSnapshot.id,
          completedAt: latestSnapshot.completedAt,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300",
        },
      }
    );
  } catch (error) {
    console.error("[leaderboard] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
