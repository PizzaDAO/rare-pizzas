import { NextRequest, NextResponse } from "next/server";
import { desc, and, inArray, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { activityEvents } from "@/db/schema";
import { resolveEnsProfiles } from "@/lib/ens-resolver";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const types = (searchParams.get("types") || "mint,sale")
      .split(",")
      .filter(Boolean);
    const collection = searchParams.get("collection") || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    const db = getDb();

    // Build conditions
    const conditions = [inArray(activityEvents.eventType, types)];
    if (collection) {
      conditions.push(eq(activityEvents.collection, collection));
    }

    // Query events
    const events = await db
      .select()
      .from(activityEvents)
      .where(and(...conditions))
      .orderBy(desc(activityEvents.happenedAt))
      .limit(limit)
      .offset(offset);

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityEvents)
      .where(and(...conditions));

    // Collect unique addresses for ENS resolution
    const addresses = new Set<string>();
    for (const event of events) {
      if (event.fromAddress) addresses.add(event.fromAddress);
      if (event.toAddress) addresses.add(event.toAddress);
    }

    // Resolve ENS (limit to avoid rate limiting)
    const uniqueAddresses = [...addresses].slice(0, 100);
    let ensMap = new Map<
      string,
      { ensName: string | null; ensAvatar: string | null }
    >();
    if (uniqueAddresses.length > 0) {
      try {
        ensMap = await resolveEnsProfiles(uniqueAddresses, db);
      } catch {
        // ENS resolution is best-effort
      }
    }

    return NextResponse.json(
      {
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          collection: e.collection,
          tokenContract: e.tokenContract,
          chainId: e.chainId,
          tokenId: e.tokenId,
          fromAddress: e.fromAddress,
          toAddress: e.toAddress,
          fromEns: e.fromAddress
            ? ensMap.get(e.fromAddress)?.ensName || null
            : null,
          toEns: e.toAddress
            ? ensMap.get(e.toAddress)?.ensName || null
            : null,
          priceWei: e.priceWei,
          currency: e.currency,
          nftName: e.nftName,
          imageUrl: e.imageUrl,
          txHash: e.txHash,
          happenedAt: e.happenedAt,
        })),
        total: Number(count),
        page: { limit, offset },
      },
      {
        headers: { "Cache-Control": "public, s-maxage=30" },
      }
    );
  } catch (error) {
    console.error("[activity] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
