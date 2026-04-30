import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS } from "@/lib/collections";
import { fetchCollectionListings } from "@/lib/opensea-api";
import {
  normalizeOpenSeaListings,
  type NormalizedListing,
} from "@/lib/normalize-listings";
import { getAllToppings } from "@/lib/toppings";

export const dynamic = "force-dynamic";

const EMPTY_RESPONSE = {
  floor: null,
  currency: "ETH",
  count: 0,
  listing: null,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const collection = searchParams.get("collection"); // slug filter
    const topping = searchParams.get("topping"); // topping SKU
    const rarity = searchParams.get("rarity"); // rarity filter
    const toppingClass = searchParams.get("class"); // topping class filter

    // ─── 1. Determine which collections to fetch ─────────────────────

    const collectionsToFetch = collection
      ? COLLECTIONS.filter((c) => c.slug === collection)
      : [...COLLECTIONS];

    // ─── 2. Fetch OpenSea listings in parallel ──────────────────────

    const openSeaResults = await Promise.allSettled(
      collectionsToFetch.map(async (col) => {
        const raw = await fetchCollectionListings(col.openseaSlug);
        return normalizeOpenSeaListings(raw, col.slug, col);
      })
    );

    let allListings: NormalizedListing[] = [];

    for (const result of openSeaResults) {
      if (result.status === "fulfilled") {
        allListings.push(...result.value);
      }
    }

    // ─── 3. Optionally fetch local DB listings ──────────────────────

    let localListings: NormalizedListing[] = [];

    if (process.env.DATABASE_URL) {
      try {
        const { getDb } = await import("@/db");
        const { listings: listingsTable, listingToppings } = await import(
          "@/db/schema"
        );
        const { eq, and, inArray } = await import("drizzle-orm");

        const db = getDb();

        const conditions = [eq(listingsTable.status, "active")];

        if (collection) {
          conditions.push(eq(listingsTable.collection, collection));
        }

        const whereClause = and(...conditions);

        const dbResults = await db
          .select()
          .from(listingsTable)
          .where(whereClause);

        // Fetch toppings for DB listings
        const dbOrderIds = dbResults.map((l) => l.orderId);
        let toppingsMap: Record<
          string,
          Array<{ toppingSku: number; rarity: string }>
        > = {};

        if (dbOrderIds.length > 0) {
          const toppingsResult = await db
            .select()
            .from(listingToppings)
            .where(inArray(listingToppings.orderId, dbOrderIds));

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

        for (const dbListing of dbResults) {
          localListings.push({
            orderId: dbListing.orderId,
            source: "local",
            collection: dbListing.collection,
            tokenContract: dbListing.tokenContract,
            chainId: dbListing.chainId,
            tokenId: dbListing.tokenId,
            seller: dbListing.seller,
            price: dbListing.price,
            currency: dbListing.currency,
            expiry:
              dbListing.expiry instanceof Date
                ? dbListing.expiry.toISOString()
                : String(dbListing.expiry),
            status: dbListing.status,
            createdAt:
              dbListing.createdAt instanceof Date
                ? dbListing.createdAt.toISOString()
                : String(dbListing.createdAt),
            orderData: dbListing.orderData,
            toppings: toppingsMap[dbListing.orderId] || [],
          });
        }
      } catch (err) {
        console.error("Error fetching local DB listings for floor:", err);
      }
    }

    // ─── 4. Merge — deduplicate by token, prefer local, then cheapest ─

    const byToken = new Map<string, NormalizedListing>();

    for (const local of localListings) {
      const key = `${local.tokenContract.toLowerCase()}:${local.tokenId}`;
      byToken.set(key, local);
    }

    for (const osListing of allListings) {
      const key = `${osListing.tokenContract.toLowerCase()}:${osListing.tokenId}`;
      const existing = byToken.get(key);
      if (!existing) {
        byToken.set(key, osListing);
      } else if (existing.source === "opensea") {
        if (BigInt(osListing.price) < BigInt(existing.price)) {
          byToken.set(key, osListing);
        }
      }
    }

    const merged = Array.from(byToken.values());

    // ─── 5. Apply filters ──────────────────────────────────────────

    let filtered = merged.filter((l) => l.status === "active");

    if (collection) {
      filtered = filtered.filter((l) => l.collection === collection);
    }

    // Topping filter
    if (topping) {
      const toppingSku = Number(topping);
      filtered = filtered.filter((l) =>
        l.toppings.some((t) => t.toppingSku === toppingSku)
      );
    }

    // Rarity filter
    if (rarity) {
      filtered = filtered.filter((l) =>
        l.toppings.some((t) => t.rarity === rarity)
      );
    }

    // Class filter
    if (toppingClass) {
      const allToppingsData = getAllToppings();
      const classSKUs = new Set(
        allToppingsData
          .filter(
            (t) => t.class.toLowerCase() === toppingClass.toLowerCase()
          )
          .map((t) => t.sku)
      );

      if (classSKUs.size === 0) {
        return NextResponse.json(EMPTY_RESPONSE);
      }

      filtered = filtered.filter((l) =>
        l.toppings.some((t) => classSKUs.has(t.toppingSku))
      );
    }

    // ─── 6. Find floor ─────────────────────────────────────────────

    if (filtered.length === 0) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    // Sort by price ascending and pick cheapest
    filtered.sort((a, b) => {
      const diff = BigInt(a.price) - BigInt(b.price);
      return diff < 0n ? -1 : diff > 0n ? 1 : 0;
    });

    const cheapest = filtered[0];
    const floorWei = BigInt(cheapest.price);
    const floorEth = Number(floorWei) / 1e18;
    const floorFormatted =
      floorEth < 0.001 ? "<0.001" : floorEth.toFixed(floorEth < 1 ? 4 : 3);

    return NextResponse.json({
      floor: floorFormatted,
      floorWei: String(floorWei),
      currency: cheapest.currency || "ETH",
      count: filtered.length,
      listing: {
        orderId: cheapest.orderId,
        tokenId: cheapest.tokenId,
        collection: cheapest.collection,
        tokenContract: cheapest.tokenContract,
        chainId: cheapest.chainId,
        seller: cheapest.seller,
        price: cheapest.price,
        currency: cheapest.currency,
      },
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
