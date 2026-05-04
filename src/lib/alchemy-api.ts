/**
 * Alchemy NFT API v3 wrapper.
 * Uses raw fetch() — no extra packages needed.
 */

function getBaseUrl(): string {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY is not set");
  return `https://eth-mainnet.g.alchemy.com/nft/v3/${key}`;
}

// ─── getOwnersForContract ────────────────────────────────────────────

interface OwnerBalance {
  ownerAddress: string;
  tokenBalances: { tokenId: string; balance: number }[];
}

/**
 * Paginated fetch of all owners for a contract.
 * Returns a Map<wallet (lowercase), tokenIds[]>.
 */
export async function getOwnersForContract(
  contractAddress: string
): Promise<Map<string, string[]>> {
  const base = getBaseUrl();
  const owners = new Map<string, string[]>();
  let pageKey: string | undefined;

  do {
    const url = new URL(`${base}/getOwnersForContract`);
    url.searchParams.set("contractAddress", contractAddress);
    url.searchParams.set("withTokenBalances", "true");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Alchemy getOwnersForContract failed (${res.status}): ${text}`
      );
    }

    const data = (await res.json()) as {
      owners: OwnerBalance[];
      pageKey?: string;
    };

    for (const owner of data.owners) {
      const wallet = owner.ownerAddress.toLowerCase();
      const existing = owners.get(wallet) || [];
      for (const tb of owner.tokenBalances) {
        existing.push(tb.tokenId);
      }
      owners.set(wallet, existing);
    }

    pageKey = data.pageKey;
  } while (pageKey);

  return owners;
}

// ─── getNftMetadataBatch ─────────────────────────────────────────────

interface TokenInput {
  contractAddress: string;
  tokenId: string;
}

interface AlchemyNftMetadata {
  contract: { address: string };
  tokenId: string;
  raw?: {
    metadata?: {
      attributes?: { trait_type: string; value: string }[];
    };
  };
}

export interface NftMetadataResult {
  contractAddress: string;
  tokenId: string;
  attributes: { trait_type: string; value: string }[];
}

/**
 * Batch fetch NFT metadata. Alchemy supports up to 100 tokens per request.
 */
export async function getNftMetadataBatch(
  tokens: TokenInput[]
): Promise<NftMetadataResult[]> {
  const base = getBaseUrl();
  const results: NftMetadataResult[] = [];

  // Process in batches of 100
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);

    const res = await fetch(`${base}/getNFTMetadataBatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: batch }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Alchemy getNftMetadataBatch failed (${res.status}): ${text}`
      );
    }

    const json = (await res.json()) as { nfts?: AlchemyNftMetadata[] } | AlchemyNftMetadata[];
    const data = Array.isArray(json) ? json : (json.nfts || []);

    for (const nft of data) {
      results.push({
        contractAddress: nft.contract.address.toLowerCase(),
        tokenId: nft.tokenId,
        attributes: nft.raw?.metadata?.attributes || [],
      });
    }
  }

  return results;
}
