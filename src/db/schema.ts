import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
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
