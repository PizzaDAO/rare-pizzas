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
 * Fetch metadata via server-side Alchemy proxy (/api/nft-metadata).
 * Falls back gracefully — tokens without metadata get null.
 */
async function fetchAllMetadata(
  tokenIds: number[],
  onProgress: (completed: number, tokenData: PizzaTokenData) => void
): Promise<PizzaTokenData[]> {
  const results: PizzaTokenData[] = [];
  const uncached: { tokenId: number; index: number }[] = [];

  // Check session cache first
  for (const tokenId of tokenIds) {
    const cached = getCachedMetadata(tokenId);
    if (cached) {
      const { toppings, unmatchedTraits } = parseToppings(cached);
      const data: PizzaTokenData = {
        tokenId,
        metadata: cached,
        toppings,
        unmatchedTraits,
      };
      results.push(data);
      onProgress(results.length, data);
    } else {
      uncached.push({ tokenId, index: results.length });
    }
  }

  if (uncached.length === 0) return results;

  // Batch fetch uncached tokens via Alchemy API route
  for (let i = 0; i < uncached.length; i += ALCHEMY_BATCH_SIZE) {
    const batch = uncached.slice(i, i + ALCHEMY_BATCH_SIZE);
    const tokens = batch.map((t) => ({
      contractAddress: RARE_PIZZAS_CONTRACT,
      tokenId: String(t.tokenId),
    }));

    try {
      const res = await fetch("/api/nft-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const data = await res.json();
      const apiResults: { tokenId: string; metadata: NFTMetadata }[] =
        data.results || [];

      // Map results back by tokenId
      const metaMap = new Map<string, NFTMetadata>();
      for (const r of apiResults) {
        metaMap.set(r.tokenId, r.metadata);
      }

      for (const item of batch) {
        const metadata = metaMap.get(String(item.tokenId)) || null;
        if (metadata) setCachedMetadata(item.tokenId, metadata);

        const { toppings, unmatchedTraits } = parseToppings(metadata);
        const tokenData: PizzaTokenData = {
          tokenId: item.tokenId,
          metadata,
          toppings,
          unmatchedTraits,
        };
        results.push(tokenData);
        onProgress(results.length, tokenData);
      }
    } catch {
      // If API fails, add tokens with null metadata
      for (const item of batch) {
        const tokenData: PizzaTokenData = {
          tokenId: item.tokenId,
          metadata: null,
          toppings: [],
          unmatchedTraits: [],
        };
        results.push(tokenData);
        onProgress(results.length, tokenData);
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
