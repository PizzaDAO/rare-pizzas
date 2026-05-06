/**
 * Activity feed ingestion pipeline.
 *
 * Steps:
 * 1. Fetch events (sale, transfer, listing, offer, cancel) for all collections
 * 2. Normalize events into a common schema
 * 3. Upsert into the activity_events table (dedup by ID)
 * 4. Prune events older than RETENTION_DAYS
 */

import { lt } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { activityEvents } from "@/db/schema";
import { fetchCollectionEvents, type OpenSeaEvent } from "./opensea-api";
import { COLLECTIONS } from "./collections";
import type * as schema from "@/db/schema";

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVENT_TYPES = ["sale", "transfer", "listing", "offer"];
const RETENTION_DAYS = 90;

interface NormalizedEvent {
  id: string;
  eventType: string;
  collection: string;
  tokenContract: string;
  chainId: number;
  tokenId: string;
  fromAddress: string | null;
  toAddress: string | null;
  priceWei: string | null;
  currency: string | null;
  nftName: string | null;
  imageUrl: string | null;
  txHash: string | null;
  happenedAt: Date;
}

function normalizeEvent(
  raw: OpenSeaEvent,
  collectionSlug: string,
  chainId: number
): NormalizedEvent | null {
  // OpenSea uses "nft" for sales/transfers, "asset" for listings/offers
  const nft = raw.nft || raw.asset;
  if (!nft) return null;

  // OpenSea returns "order" as event_type for listings/offers; use order_type to distinguish
  let eventType = raw.event_type;
  if (eventType === "order" && raw.order_type) {
    eventType = raw.order_type; // "listing" or "offer"
  }

  let fromAddress = raw.from_address || raw.seller || raw.maker || null;
  let toAddress = raw.to_address || raw.buyer || raw.taker || null;

  // Reclassify transfer from null address as mint
  if (eventType === "transfer" && fromAddress?.toLowerCase() === NULL_ADDRESS) {
    eventType = "mint";
    fromAddress = null;
  }

  // Extract price
  let priceWei: string | null = null;
  let currency: string | null = null;
  if (raw.payment) {
    priceWei = raw.payment.quantity;
    currency = raw.payment.symbol || "ETH";
  }

  const uniqueKey = raw.transaction || raw.order_hash || `${raw.event_timestamp}`;
  const id = `${uniqueKey}:${nft.contract}:${nft.identifier}:${eventType}`;

  return {
    id,
    eventType,
    collection: collectionSlug,
    tokenContract: nft.contract || "",
    chainId,
    tokenId: nft.identifier || "0",
    fromAddress: fromAddress?.toLowerCase() || null,
    toAddress: toAddress?.toLowerCase() || null,
    priceWei,
    currency,
    nftName: nft.name || null,
    imageUrl: nft.image_url || null,
    txHash: raw.transaction || null,
    happenedAt: new Date(
      typeof raw.event_timestamp === "number"
        ? raw.event_timestamp * 1000
        : raw.event_timestamp
    ),
  };
}

export async function ingestActivityEvents(
  db: NeonHttpDatabase<typeof schema>,
  backfill = false
): Promise<{ ingested: number; pruned: number }> {
  const maxPages = backfill ? 20 : 4;
  let totalIngested = 0;

  // Process all 3 collections in parallel
  const results = await Promise.allSettled(
    COLLECTIONS.map(async (collection) => {
      let collectionIngested = 0;

      // Fetch all event types in parallel for this collection
      const typeResults = await Promise.allSettled(
        EVENT_TYPES.map(async (eventType) => {
          const { events } = await fetchCollectionEvents(
            collection.openseaSlug,
            eventType,
            { maxPages }
          );
          return events;
        })
      );

      const allEvents: OpenSeaEvent[] = [];
      for (const r of typeResults) {
        if (r.status === "fulfilled") allEvents.push(...r.value);
      }

      // Normalize events
      const normalized = allEvents
        .map((e) => normalizeEvent(e, collection.openseaSlug, collection.chainId))
        .filter((e): e is NormalizedEvent => e !== null);

      // Upsert in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
        const batch = normalized.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;

        await db
          .insert(activityEvents)
          .values(batch)
          .onConflictDoNothing();

        collectionIngested += batch.length;
      }

      console.log(
        `[activity] Ingested ${collectionIngested} events for ${collection.openseaSlug}`
      );
      return collectionIngested;
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") totalIngested += r.value;
  }

  // Prune old events
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .delete(activityEvents)
    .where(lt(activityEvents.happenedAt, cutoff));

  console.log(
    `[activity] Total ingested: ${totalIngested}, pruned events older than ${RETENTION_DAYS} days`
  );
  return { ingested: totalIngested, pruned: 0 };
}
