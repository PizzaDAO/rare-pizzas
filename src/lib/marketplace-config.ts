// ─── Marketplace Fee Configuration ──────────────────────────────────
// Fees are encoded as Seaport consideration items at order creation time (Phase 3).
// For Phase 2 (fulfillment), we just display them — they're already baked into the order.

/** Marketplace platform fee in basis points (1% = 100 bps) */
export const MARKETPLACE_FEE_BPS = 100;

/** Creator royalty in basis points (6.25% = 625 bps) */
export const CREATOR_ROYALTY_BPS = 625;

/** Total fee in basis points (7.25%) */
export const TOTAL_FEE_BPS = MARKETPLACE_FEE_BPS + CREATOR_ROYALTY_BPS;

/** Fee recipient ENS name — resolve to address at order time */
export const FEE_RECIPIENT_ENS = "dreadpizzaroberts.eth";

/** Seaport 1.6 contract address (same on all chains) */
export const SEAPORT_ADDRESS = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as const;

// ─── Helpers ────────────────────────────────────────────────────────

/** Calculate marketplace fee from a price in wei */
export function calculateMarketplaceFee(priceWei: bigint): bigint {
  return (priceWei * BigInt(MARKETPLACE_FEE_BPS)) / 10000n;
}

/** Calculate creator royalty from a price in wei */
export function calculateCreatorRoyalty(priceWei: bigint): bigint {
  return (priceWei * BigInt(CREATOR_ROYALTY_BPS)) / 10000n;
}

/** Calculate total price including all fees */
export function calculateTotalWithFees(priceWei: bigint): {
  itemPrice: bigint;
  marketplaceFee: bigint;
  creatorRoyalty: bigint;
  total: bigint;
} {
  const marketplaceFee = calculateMarketplaceFee(priceWei);
  const creatorRoyalty = calculateCreatorRoyalty(priceWei);
  return {
    itemPrice: priceWei,
    marketplaceFee,
    creatorRoyalty,
    total: priceWei + marketplaceFee + creatorRoyalty,
  };
}

/** Format basis points as a percentage string (e.g., 625 -> "6.25%") */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}
