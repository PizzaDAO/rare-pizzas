"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  RARE_PIZZAS_CONTRACT,
  ERC721_ENUMERABLE_ABI,
  EXCLUDED_TRAIT_TYPES,
} from "@/lib/constants";
import { matchTopping } from "@/lib/toppings";
import type {
  Topping,
  OwnedTopping,
  PizzaTokenData,
  NFTMetadata,
  NFTAttribute,
} from "@/lib/types";

const SESSION_STORAGE_PREFIX = "rp-meta-";
const ALCHEMY_BATCH_SIZE = 100;
const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;

function getCachedMetadata(tokenId: number): NFTMetadata | null {
  try {
    const cached = sessionStorage.getItem(
      `${SESSION_STORAGE_PREFIX}${tokenId}`
    );
    if (cached) return JSON.parse(cached);
  } catch {
    // sessionStorage not available or parse error
  }
  return null;
}

function setCachedMetadata(tokenId: number, metadata: NFTMetadata): void {
  try {
    sessionStorage.setItem(
      `${SESSION_STORAGE_PREFIX}${tokenId}`,
      JSON.stringify(metadata)
    );
  } catch {
    // sessionStorage full or not available
  }
}

function parseToppings(metadata: NFTMetadata | null): {
  toppings: Topping[];
  unmatchedTraits: NFTAttribute[];
} {
  const toppings: Topping[] = [];
  const unmatchedTraits: NFTAttribute[] = [];
  if (metadata?.attributes) {
    for (const attr of metadata.attributes) {
      if (EXCLUDED_TRAIT_TYPES.has(attr.trait_type)) continue;
      const matched = matchTopping(attr);
      if (matched) {
        toppings.push(matched);
      } else {
        unmatchedTraits.push(attr);
      }
    }
  }
  return { toppings, unmatchedTraits };
}

/**
 * Fetch metadata directly from Alchemy's NFT API (client-side).
 * No serverless function in the path = no cold start latency.
 */
async function fetchAllMetadata(
  tokenIds: number[],
  onProgress: (completed: number, tokenData: PizzaTokenData) => void
): Promise<PizzaTokenData[]> {
  const results: PizzaTokenData[] = [];
  const uncached: number[] = [];

  // Check session cache first
  for (const tokenId of tokenIds) {
    const cached = getCachedMetadata(tokenId);
    if (cached) {
      const { toppings, unmatchedTraits } = parseToppings(cached);
      results.push({ tokenId, metadata: cached, toppings, unmatchedTraits });
      onProgress(results.length, results[results.length - 1]);
    } else {
      uncached.push(tokenId);
    }
  }

  if (uncached.length === 0) return results;

  // Batch fetch uncached tokens directly from Alchemy (up to 100 per call)
  for (let i = 0; i < uncached.length; i += ALCHEMY_BATCH_SIZE) {
    const batch = uncached.slice(i, i + ALCHEMY_BATCH_SIZE);
    const tokens = batch.map((id) => ({
      contractAddress: RARE_PIZZAS_CONTRACT,
      tokenId: String(id),
    }));

    try {
      const res = await fetch(`${ALCHEMY_BASE}/getNFTMetadataBatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });

      if (!res.ok) throw new Error(`Alchemy returned ${res.status}`);

      const json = await res.json();
      const nfts = json.nfts || json;

      // Index by tokenId for fast lookup
      const metaMap = new Map<string, NFTMetadata>();
      for (const nft of nfts) {
        const meta: NFTMetadata = {
          name: nft.raw?.metadata?.name || nft.name || undefined,
          description: nft.raw?.metadata?.description || undefined,
          image:
            nft.image?.cachedUrl ||
            nft.image?.originalUrl ||
            nft.raw?.metadata?.image ||
            undefined,
          attributes: nft.raw?.metadata?.attributes || [],
        };
        metaMap.set(nft.tokenId, meta);
      }

      for (const tokenId of batch) {
        const metadata = metaMap.get(String(tokenId)) || null;
        if (metadata) setCachedMetadata(tokenId, metadata);

        const { toppings, unmatchedTraits } = parseToppings(metadata);
        const tokenData: PizzaTokenData = {
          tokenId,
          metadata,
          toppings,
          unmatchedTraits,
        };
        results.push(tokenData);
        onProgress(results.length, tokenData);
      }
    } catch {
      // If Alchemy fails, add tokens with null metadata
      for (const tokenId of batch) {
        results.push({
          tokenId,
          metadata: null,
          toppings: [],
          unmatchedTraits: [],
        });
        onProgress(results.length, results[results.length - 1]);
      }
    }
  }

  return results;
}

export interface UseWalletToppingsReturn {
  isLoading: boolean;
  isLoadingOnChain: boolean;
  isLoadingMetadata: boolean;
  error: string | null;
  pizzas: PizzaTokenData[];
  ownedToppings: OwnedTopping[];
  totalPizzas: number;
  loadedPizzas: number;
  unmatchedTraits: NFTAttribute[];
}

export function useWalletToppings(): UseWalletToppingsReturn {
  const { address, isConnected } = useAccount();

  const [pizzas, setPizzas] = useState<PizzaTokenData[]>([]);
  const [loadedPizzas, setLoadedPizzas] = useState(0);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // Step 1: Get balance
  const {
    data: balance,
    isLoading: isLoadingBalance,
    error: balanceError,
  } = useReadContract({
    address: RARE_PIZZAS_CONTRACT,
    abi: ERC721_ENUMERABLE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const totalPizzas = balance ? Number(balance) : 0;

  // Step 2: Get all token IDs via tokenOfOwnerByIndex
  const tokenIndexContracts = useMemo(() => {
    if (!address || !totalPizzas) return [];
    return Array.from({ length: totalPizzas }, (_, i) => ({
      address: RARE_PIZZAS_CONTRACT,
      abi: ERC721_ENUMERABLE_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, totalPizzas]);

  const {
    data: tokenIdResults,
    isLoading: isLoadingTokenIds,
    error: tokenIdsError,
  } = useReadContracts({
    contracts: tokenIndexContracts,
    batchSize: 0,
    query: {
      enabled: tokenIndexContracts.length > 0,
    },
  });

  const tokenIds = useMemo(() => {
    if (!tokenIdResults) return [];
    return tokenIdResults
      .filter((r) => r.status === "success" && r.result !== undefined)
      .map((r) => Number(r.result as bigint));
  }, [tokenIdResults]);

  // Step 3: Fetch metadata via Alchemy API (no tokenURI calls needed)
  const fetchMetadata = useCallback(async () => {
    if (!tokenIds.length) return;

    setIsLoadingMetadata(true);
    setMetadataError(null);
    setPizzas([]);
    setLoadedPizzas(0);

    try {
      const results = await fetchAllMetadata(
        tokenIds,
        (completed, data) => {
          setLoadedPizzas(completed);
          setPizzas((prev) => [...prev, data]);
        }
      );
      // Final set with all results to ensure consistency
      setPizzas(results);
      setLoadedPizzas(results.length);
    } catch (err) {
      setMetadataError(
        err instanceof Error ? err.message : "Failed to load metadata"
      );
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [tokenIds]);

  useEffect(() => {
    if (tokenIds.length > 0) {
      fetchMetadata();
    }
  }, [tokenIds.length, fetchMetadata]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setPizzas([]);
      setLoadedPizzas(0);
      setIsLoadingMetadata(false);
      setMetadataError(null);
    }
  }, [isConnected]);

  // Aggregate owned toppings with counts
  const ownedToppings = useMemo(() => {
    const map = new Map<
      number,
      { topping: Topping; count: number; tokenIds: number[] }
    >();
    for (const pizza of pizzas) {
      for (const t of pizza.toppings) {
        const existing = map.get(t.sku);
        if (existing) {
          existing.count++;
          existing.tokenIds.push(pizza.tokenId);
        } else {
          map.set(t.sku, {
            topping: t,
            count: 1,
            tokenIds: [pizza.tokenId],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [pizzas]);

  // Aggregate unmatched traits
  const unmatchedTraits = useMemo(() => {
    const traits: NFTAttribute[] = [];
    for (const pizza of pizzas) {
      traits.push(...pizza.unmatchedTraits);
    }
    return traits;
  }, [pizzas]);

  const isLoadingOnChain = isLoadingBalance || isLoadingTokenIds;

  const error =
    metadataError ||
    (balanceError ? balanceError.message : null) ||
    (tokenIdsError ? tokenIdsError.message : null);

  return {
    isLoading: isLoadingOnChain || isLoadingMetadata,
    isLoadingOnChain,
    isLoadingMetadata,
    error,
    pizzas,
    ownedToppings,
    totalPizzas,
    loadedPizzas,
    unmatchedTraits,
  };
}
