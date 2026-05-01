const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";

// ─── Cache types ────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const listingsCache = new Map<string, CacheEntry<unknown[]>>();
const nftMetadataCache = new Map<string, CacheEntry<OpenSeaNFTMetadata | null>>();

const LISTINGS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const NFT_METADATA_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Types ──────────────────────────────────────────────────────────

export interface OpenSeaNFTMetadata {
  name: string;
  image_url: string;
  traits: { trait_type: string; value: string }[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function getApiKey(): string {
  return process.env.OPENSEA_API_KEY || "";
}

function chainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 10:
      return "optimism";
    default:
      return "ethereum";
  }
}

export { chainName as getChainName };

// ─── Fetch collection listings (paginated) ──────────────────────────

/**
 * Fetch all active listings for a collection from OpenSea.
 * Paginates using the `next` cursor until exhausted or a reasonable limit.
 */
export async function fetchCollectionListings(
  openseaSlug: string
): Promise<unknown[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return [];
  }

  // Check cache
  const cached = listingsCache.get(openseaSlug);
  if (cached && Date.now() - cached.timestamp < LISTINGS_TTL_MS) {
    return cached.data;
  }

  const allListings: unknown[] = [];
  let nextCursor: string | null = null;
  const maxPages = 10; // Safety limit: 10 pages * 100 items = 1000 listings max

  try {
    for (let page = 0; page < maxPages; page++) {
      const url = new URL(
        `${OPENSEA_API_BASE}/listings/collection/${openseaSlug}/all`
      );
      url.searchParams.set("limit", "100");
      if (nextCursor) {
        url.searchParams.set("next", nextCursor);
      }

      const res = await fetch(url.toString(), {
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      });

      if (res.status === 429) {
        // Rate limited — serve stale cache if available
        console.warn(
          `OpenSea rate limit hit for ${openseaSlug}, serving stale cache`
        );
        if (cached) return cached.data;
        return allListings; // return what we have so far
      }

      if (!res.ok) {
        console.error(
          `OpenSea API error for ${openseaSlug}: ${res.status} ${res.statusText}`
        );
        if (cached) return cached.data;
        return allListings;
      }

      const data = await res.json();
      const listings = data.listings || [];
      allListings.push(...listings);

      nextCursor = data.next || null;
      if (!nextCursor || listings.length === 0) {
        break;
      }
    }
  } catch (error) {
    console.error(`OpenSea API fetch error for ${openseaSlug}:`, error);
    if (cached) return cached.data;
    return allListings;
  }

  // Update cache
  listingsCache.set(openseaSlug, {
    data: allListings,
    timestamp: Date.now(),
  });

  return allListings;
}

// ─── Fetch NFT metadata ────────────────────────────────────────────

/**
 * Fetch traits and image for a single NFT from OpenSea.
 */
export async function fetchNFTMetadata(
  chain: string,
  contract: string,
  tokenId: string
): Promise<OpenSeaNFTMetadata | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const cacheKey = `${chain}:${contract}:${tokenId}`;
  const cached = nftMetadataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NFT_METADATA_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `${OPENSEA_API_BASE}/chain/${chain}/contract/${contract}/nfts/${tokenId}`;
    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (res.status === 429) {
      console.warn(`OpenSea rate limit hit for NFT ${cacheKey}`);
      if (cached) return cached.data;
      return null;
    }

    if (!res.ok) {
      console.error(
        `OpenSea NFT metadata error for ${cacheKey}: ${res.status}`
      );
      if (cached) return cached.data;
      return null;
    }

    const data = await res.json();
    const nft = data.nft;
    if (!nft) return null;

    const metadata: OpenSeaNFTMetadata = {
      name: nft.name || "",
      image_url: nft.image_url || "",
      traits: (nft.traits || []).map(
        (t: { trait_type: string; value: string }) => ({
          trait_type: t.trait_type,
          value: String(t.value),
        })
      ),
    };

    nftMetadataCache.set(cacheKey, {
      data: metadata,
      timestamp: Date.now(),
    });

    return metadata;
  } catch (error) {
    console.error(`OpenSea NFT metadata fetch error for ${cacheKey}:`, error);
    if (cached) return cached.data;
    return null;
  }
}

// ─── Cross-post listing to OpenSea ───────────────────────────────────

/**
 * Submit a signed Seaport order to OpenSea's order book so it appears
 * on both rarepizzas.com and opensea.io.
 *
 * @param chainId - Chain ID (1 = Ethereum, 10 = Optimism)
 * @param orderData - The signed OrderWithCounter from seaport-js
 * @param protocolAddress - Seaport contract address used to create the order
 * @returns true if successful, false otherwise
 */
export async function crossPostToOpenSea(
  chainId: number,
  orderData: { parameters: Record<string, unknown>; signature: string },
  protocolAddress: string
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[opensea] No API key — skipping cross-post");
    return false;
  }

  const chain = chainName(chainId);
  const url = `${OPENSEA_API_BASE}/orders/${chain}/seaport/listings`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        parameters: {
          ...orderData.parameters,
          protocol_address: protocolAddress,
        },
        signature: orderData.signature,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[opensea] Cross-post failed: ${res.status} ${res.statusText}`,
        errBody
      );
      return false;
    }

    console.log(`[opensea] Cross-posted listing to OpenSea (${chain})`);
    return true;
  } catch (error) {
    console.error("[opensea] Cross-post error:", error);
    return false;
  }
}
