import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ─── Listings ────────────────────────────────────────────────────────

export const listings = pgTable("listings", {
  orderId: text("order_id").primaryKey(),
  orderData: jsonb("order_data").notNull(),
  collection: text("collection").notNull(), // slug: rare-pizzas-box, rare-pizzas, pizza-sticks
  tokenContract: text("token_contract").notNull(),
  chainId: integer("chain_id").notNull(), // 1 = Ethereum, 10 = Optimism
  tokenId: text("token_id").notNull(),
  seller: text("seller").notNull(),
  price: text("price").notNull(), // wei as string (avoids bigint precision issues)
  currency: text("currency").notNull(), // ETH
  expiry: timestamp("expiry", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"), // active, filled, cancelled, expired
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Listing Toppings (join table for topping-based filtering) ───────

export const listingToppings = pgTable(
  "listing_toppings",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => listings.orderId, { onDelete: "cascade" }),
    toppingSku: integer("topping_sku").notNull(),
    rarity: text("rarity").notNull(), // common, uncommon, rare, superrare, epic, grail
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.toppingSku] }),
  ]
);

// ─── Offers ──────────────────────────────────────────────────────────

export const offers = pgTable("offers", {
  offerId: text("offer_id").primaryKey(),
  orderData: jsonb("order_data").notNull(),
  collection: text("collection").notNull(),
  tokenContract: text("token_contract").notNull(),
  chainId: integer("chain_id").notNull(),
  tokenId: text("token_id"), // null for collection-wide offers
  offerer: text("offerer").notNull(),
  amount: text("amount").notNull(), // wei as string
  currency: text("currency").notNull(),
  expiry: timestamp("expiry", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"), // active, accepted, cancelled, expired
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Leaderboard ─────────────────────────────────────────────────────

export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status").notNull().default("running"), // running, completed, failed
  holderCount: integer("holder_count"),
  tokenCount: integer("token_count"),
});

export const leaderboardHolders = pgTable(
  "leaderboard_holders",
  {
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => leaderboardSnapshots.id, { onDelete: "cascade" }),
    wallet: text("wallet").notNull(),
    pizzaCount: integer("pizza_count").notNull().default(0),
    boxCount: integer("box_count").notNull().default(0),
    totalNfts: integer("total_nfts").notNull().default(0),
    rarityScore: integer("rarity_score").notNull().default(0),
    uniqueToppings: integer("unique_toppings").notNull().default(0),
    completenessScore: integer("completeness_score").notNull().default(0), // 0-10000 = xx.xx%
    ensName: text("ens_name"),
    ensAvatar: text("ens_avatar"),
    rankByTotal: integer("rank_by_total"),
    rankByRarity: integer("rank_by_rarity"),
    rankByCompleteness: integer("rank_by_completeness"),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.wallet] }),
  ]
);

export const ensCache = pgTable("ens_cache", {
  wallet: text("wallet").primaryKey(),
  ensName: text("ens_name"),
  ensAvatar: text("ens_avatar"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Activity Feed ──────────────────────────────────────────────────

export const activityEvents = pgTable("activity_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  collection: text("collection").notNull(),
  tokenContract: text("token_contract").notNull(),
  chainId: integer("chain_id").notNull(),
  tokenId: text("token_id").notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  priceWei: text("price_wei"),
  currency: text("currency"),
  nftName: text("nft_name"),
  imageUrl: text("image_url"),
  txHash: text("tx_hash"),
  happenedAt: timestamp("happened_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("activity_events_type_time_idx").on(table.eventType, table.happenedAt),
  index("activity_events_collection_time_idx").on(table.collection, table.happenedAt),
  index("activity_events_happened_at_idx").on(table.happenedAt),
]);

export const activityCursors = pgTable("activity_cursors", {
  slug: text("slug").primaryKey(),
  cursor: text("cursor"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
