import type { Collection } from "./collections";
import { fetchNFTMetadata, getChainName } from "./opensea-api";
import { checkBoxRedemptions } from "./box-redemption";
import { matchTopping } from "./toppings";
import type { NFTAttribute } from "./types";

// ─── Types ──────────────────────────────────────────────────────────

export interface NormalizedListing {
  orderId: string;
  source: "opensea" | "local";
  collection: string; // internal slug
  tokenContract: string;
  chainId: number;
  tokenId: string;
  seller: string;
  price: string; // wei
  currency: string;
  expiry: string;
  status: string;
  createdAt: string;
  orderData?: unknown; // only for local listings (Seaport order for on-site Buy Now)
  toppings: { toppingSku: number; rarity: string }[];
  imageUrl?: string; // NFT image from OpenSea
  nftName?: string;
  isBoxOpened?: boolean; // only for rare-pizzas-box
  openseaUrl?: string; // direct OpenSea link to item
}

// ─── Helpers ────────────────────────────────────────────────────────

function chainSlug(chainId: number): string {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 10:
      return "optimism";
    default:
      return "ethereum";
  }
}

// ─── Normalizer ─────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalize raw OpenSea listing objects into our unified format.
 *
 * @param rawListings - Raw listing objects from OpenSea API
 * @param collectionSlug - Our internal collection slug
 * @param collection - The Collection config object
 */
export async function normalizeOpenSeaListings(
  rawListings: any[],
  collectionSlug: string,
  collection: Collection
): Promise<NormalizedListing[]> {
  const chain = chainSlug(collection.chainId);

  // Extract basic fields from each listing
  const listings: NormalizedListing[] = [];

  for (const raw of rawListings) {
    try {
      const protocolData = raw.protocol_data;
      if (!protocolData?.parameters) continue;

      const params = protocolData.parameters;

      // Extract tokenId from offer
      const offer = params.offer;
      if (!offer || offer.length === 0) continue;
      const tokenId = String(offer[0].identifierOrCriteria);

      // Extract seller
      const seller = params.offerer?.toLowerCase() || "";

      // Extract price — use price.current.value (total buyer pays in smallest unit)
      const priceValue = raw.price?.current?.value;
      if (!priceValue) continue;
      const price = String(priceValue);

      // Extract currency
      const currency = raw.price?.current?.currency || "ETH";

      // Order hash
      const orderId = raw.order_hash || `os-${collectionSlug}-${tokenId}-${Date.now()}`;

      // Timestamps
      const endTime = params.endTime
        ? new Date(Number(params.endTime) * 1000).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const startTime = params.startTime
        ? new Date(Number(params.startTime) * 1000).toISOString()
        : new Date().toISOString();

      // OpenSea URL
      const openseaUrl = `https://opensea.io/assets/${chain}/${collection.contract}/${tokenId}`;

      listings.push({
        orderId,
        source: "opensea",
        collection: collectionSlug,
        tokenContract: collection.contract,
        chainId: collection.chainId,
        tokenId,
        seller,
        price,
        currency,
        expiry: endTime,
        status: "active",
        createdAt: startTime,
        toppings: [],
        openseaUrl,
      });
    } catch (err) {
      console.error("Error normalizing OpenSea listing:", err);
      continue;
    }
  }

  if (listings.length === 0) return listings;

  // ─── Enrich: NFT metadata (image, name, toppings) ─────────────────

  const metadataChain = getChainName(collection.chainId);

  // Batch metadata fetches (parallel with concurrency limit)
  const CONCURRENCY = 5;
  for (let i = 0; i < listings.length; i += CONCURRENCY) {
    const batch = listings.slice(i, i + CONCURRENCY);
    const metadataResults = await Promise.allSettled(
      batch.map((l) =>
        fetchNFTMetadata(metadataChain, collection.contract, l.tokenId)
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const result = metadataResults[j];
      if (result.status === "fulfilled" && result.value) {
        const nft = result.value;
        batch[j].imageUrl = nft.image_url || undefined;
        batch[j].nftName = nft.name || undefined;

        // Topping enrichment — only for rare-pizzas collection
        if (collectionSlug === "rare-pizzas" && nft.traits) {
          const toppings: { toppingSku: number; rarity: string }[] = [];
          for (const trait of nft.traits) {
            const attr: NFTAttribute = {
              trait_type: trait.trait_type,
              value: trait.value,
            };
            const matched = matchTopping(attr);
            if (matched) {
              toppings.push({
                toppingSku: matched.sku,
                rarity: matched.rarity,
              });
            }
          }
          batch[j].toppings = toppings;
        }
      }
    }
  }

  // ─── Enrich: Box redemption status ────────────────────────────────

  if (collectionSlug === "rare-pizzas-box") {
    const tokenIds = listings.map((l) => l.tokenId);
    const redemptions = await checkBoxRedemptions(tokenIds);

    for (const listing of listings) {
      const isRedeemed = redemptions.get(listing.tokenId);
      listing.isBoxOpened = isRedeemed ?? false;
    }
  }

  return listings;
}
