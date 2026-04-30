import { getPublicClient } from "./viem-client";
import { PIZZA_ABI, RARE_PIZZAS_CONTRACT } from "./contracts";

/**
 * Permanent cache: once a box is redeemed, it stays redeemed.
 * We only re-check tokens not yet known as redeemed.
 */
const redemptionCache = new Map<string, boolean>();

/**
 * Check whether Rare Pizzas Box tokens have been redeemed (opened).
 *
 * Uses viem multicall against the RarePizzas contract's `isRedeemed(uint256)`.
 * Results for redeemed boxes are cached permanently since redemption is one-way.
 */
export async function checkBoxRedemptions(
  tokenIds: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  if (tokenIds.length === 0) return results;

  // Separate already-cached from unchecked
  const toCheck: string[] = [];
  for (const id of tokenIds) {
    const cached = redemptionCache.get(id);
    if (cached !== undefined) {
      results.set(id, cached);
    } else {
      toCheck.push(id);
    }
  }

  if (toCheck.length === 0) return results;

  try {
    const client = getPublicClient(1); // mainnet

    const calls = toCheck.map((tokenId) => ({
      address: RARE_PIZZAS_CONTRACT as `0x${string}`,
      abi: PIZZA_ABI,
      functionName: "isRedeemed" as const,
      args: [BigInt(tokenId)],
    }));

    const multicallResults = await client.multicall({
      contracts: calls,
      allowFailure: true,
    });

    for (let i = 0; i < toCheck.length; i++) {
      const tokenId = toCheck[i];
      const result = multicallResults[i];

      if (result.status === "success") {
        const isRedeemed = result.result as boolean;
        redemptionCache.set(tokenId, isRedeemed);
        results.set(tokenId, isRedeemed);
      } else {
        // On failure, don't cache — leave as unknown
        results.set(tokenId, false);
      }
    }
  } catch (error) {
    console.error("Box redemption multicall error:", error);
    // On total failure, set all unchecked to false (unknown)
    for (const id of toCheck) {
      results.set(id, false);
    }
  }

  return results;
}
