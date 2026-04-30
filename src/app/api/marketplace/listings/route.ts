import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS } from "@/lib/collections";
import { fetchCollectionListings } from "@/lib/opensea-api";
import {
  normalizeOpenSeaListings,
  type NormalizedListing,
} from "@/lib/normalize-listings";

export const dynamic = "force-dynamic";

const EMPTY = NextResponse.json({ listings: [], total: 0 });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const collection = searchParams.get("collection"); // slug filter
    const topping = searchParams.get("topping"); // topping SKU
    const rarity = searchParams.get("rarity"); // rarity filter
    const priceMin = searchParams.get("priceMin"); // min price in wei
    const priceMax = searchParams.get("priceMax"); // max price in wei
    const chain = searchParams.get("chain"); // chain ID
    const seller = searchParams.get("seller"); // seller address filter
    const status = searchParams.get("status"); // status filter
    const sort = searchParams.get("sort") || "newest";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    // ─── 1. Determine which collections to fetch ─────────────────────

    const collectionsToFetch = collection
      ? COLLECTIONS.filter((c) => c.slug === collection)
      : [...COLLECTIONS];

    if (collectionsToFetch.length === 0) {
      return EMPTY;
    }

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

        // Build conditions for DB query
        const conditions = [];

        // When seller is specified, show all statuses; otherwise only active
        if (seller) {
          if (status) {
            conditions.push(eq(listingsTable.status, status));
          }
        } else {
          conditions.push(eq(listingsTable.status, status || "active"));
        }

        if (collection) {
          conditions.push(eq(listingsTable.collection, collection));
        }
        if (seller) {
          conditions.push(eq(listingsTable.seller, seller.toLowerCase()));
        }
        if (chain) {
          conditions.push(eq(listingsTable.chainId, Number(chain)));
        }

        const whereClause =
          conditions.length > 0 ? and(...conditions) : undefined;

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

        // Convert DB listings to NormalizedListing
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
        console.error("Error fetching local DB listings:", err);
        // Continue with OpenSea-only listings
      }
    }

    // ─── 4. Merge — prefer local version when same token exists ─────

    const localByToken = new Map<string, NormalizedListing>();
    for (const local of localListings) {
      const key = `${local.tokenContract.toLowerCase()}:${local.tokenId}`;
      localByToken.set(key, local);
    }

    const merged: NormalizedListing[] = [...localListings];

    for (const osListing of allListings) {
      const key = `${osListing.tokenContract.toLowerCase()}:${osListing.tokenId}`;
      if (!localByToken.has(key)) {
        merged.push(osListing);
      }
    }

    // ─── 5. Apply in-memory filters ────────────────────────────────

    let filtered = merged;

    // Collection filter
    if (collection) {
      filtered = filtered.filter((l) => l.collection === collection);
    }

    // Chain filter
    if (chain) {
      filtered = filtered.filter((l) => l.chainId === Number(chain));
    }

    // Seller filter (case-insensitive)
    if (seller) {
      const sellerLower = seller.toLowerCase();
      filtered = filtered.filter((l) => l.seller.toLowerCase() === sellerLower);
    }

    // Status filter — when no seller, only show active by default
    if (!seller) {
      const statusFilter = status || "active";
      filtered = filtered.filter((l) => l.status === statusFilter);
    } else if (status) {
      filtered = filtered.filter((l) => l.status === status);
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

    // Price filters
    if (priceMin) {
      const min = BigInt(priceMin);
      filtered = filtered.filter((l) => BigInt(l.price) >= min);
    }

    if (priceMax) {
      const max = BigInt(priceMax);
      filtered = filtered.filter((l) => BigInt(l.price) <= max);
    }

    // ─── 6. Sort ────────────────────────────────────────────────────

    switch (sort) {
      case "price-asc":
        filtered.sort((a, b) => {
          const diff = BigInt(a.price) - BigInt(b.price);
          return diff < 0n ? -1 : diff > 0n ? 1 : 0;
        });
        break;
      case "price-desc":
        filtered.sort((a, b) => {
          const diff = BigInt(b.price) - BigInt(a.price);
          return diff < 0n ? -1 : diff > 0n ? 1 : 0;
        });
        break;
      case "newest":
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    // ─── 7. Paginate ───────────────────────────────────────────────

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      listings: paginated,
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
