/**
 * Leaderboard snapshot pipeline.
 *
 * Steps:
 * 1. Create snapshot record (status=running)
 * 2. Fetch all owners for Rare Pizzas + Rare Pizzas Box via Alchemy
 * 3. Fetch NFT metadata for all Rare Pizzas tokens (for topping/rarity scoring)
 * 4. Compute scores per holder
 * 5. Resolve ENS names/avatars
 * 6. Compute ranks
 * 7. Bulk insert holder rows
 * 8. Mark snapshot completed
 * 9. Prune old snapshots (keep latest 5)
 */

import { eq, desc } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { leaderboardSnapshots, leaderboardHolders } from "@/db/schema";
import { getOwnersForContract, getNftMetadataBatch } from "./alchemy-api";
import { matchTopping } from "./toppings";
import { RARITY_WEIGHTS, TOTAL_UNIQUE_TOPPINGS } from "./rarity-weights";
import { resolveEnsProfiles } from "./ens-resolver";
import type { Rarity } from "./types";
import type * as schema from "@/db/schema";

const RARE_PIZZAS_CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0";
const RARE_PIZZAS_BOX_CONTRACT = "0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7";

interface HolderData {
  wallet: string;
  pizzaCount: number;
  boxCount: number;
  totalNfts: number;
  rarityScore: number;
  uniqueToppings: number;
  completenessScore: number;
  ensName: string | null;
  ensAvatar: string | null;
}

export async function runSnapshot(
  db: NeonHttpDatabase<typeof schema>
): Promise<string> {
  const snapshotId = crypto.randomUUID();

  // 1. Create snapshot record
  await db.insert(leaderboardSnapshots).values({
    id: snapshotId,
    status: "running",
  });

  try {
    // 2. Fetch owners for both contracts
    console.log("[leaderboard] Fetching pizza owners...");
    const [pizzaOwners, boxOwners] = await Promise.all([
      getOwnersForContract(RARE_PIZZAS_CONTRACT),
      getOwnersForContract(RARE_PIZZAS_BOX_CONTRACT),
    ]);

    // 3. Merge into a set of all unique holders
    const allWallets = new Set<string>();
    for (const wallet of pizzaOwners.keys()) allWallets.add(wallet);
    for (const wallet of boxOwners.keys()) allWallets.add(wallet);

    console.log(
      `[leaderboard] Found ${allWallets.size} unique holders (${pizzaOwners.size} pizza, ${boxOwners.size} box)`
    );

    // 4. Fetch metadata for all pizza tokens (for rarity scoring)
    const allPizzaTokens: { contractAddress: string; tokenId: string }[] = [];
    for (const [, tokenIds] of pizzaOwners) {
      for (const tokenId of tokenIds) {
        allPizzaTokens.push({
          contractAddress: RARE_PIZZAS_CONTRACT,
          tokenId,
        });
      }
    }

    console.log(
      `[leaderboard] Fetching metadata for ${allPizzaTokens.length} pizza tokens...`
    );
    const metadataResults = await getNftMetadataBatch(allPizzaTokens);

    // Build a map: tokenId -> attributes
    const tokenMetadata = new Map<
      string,
      { trait_type: string; value: string }[]
    >();
    for (const m of metadataResults) {
      tokenMetadata.set(m.tokenId, m.attributes);
    }

    // 5. Compute scores per holder
    const holders: HolderData[] = [];

    for (const wallet of allWallets) {
      const pizzaTokenIds = pizzaOwners.get(wallet) || [];
      const boxTokenIds = boxOwners.get(wallet) || [];
      const pizzaCount = pizzaTokenIds.length;
      const boxCount = boxTokenIds.length;
      const totalNfts = pizzaCount + boxCount;

      // Compute rarity score + unique toppings from pizza metadata
      let rarityScore = 0;
      const seenToppingSku = new Set<number>();

      for (const tokenId of pizzaTokenIds) {
        const attributes = tokenMetadata.get(tokenId) || [];
        for (const attr of attributes) {
          const topping = matchTopping(attr);
          if (topping) {
            const weight = RARITY_WEIGHTS[topping.rarity as Rarity] || 1;
            rarityScore += weight;
            seenToppingSku.add(topping.sku);
          }
        }
      }

      const uniqueToppings = seenToppingSku.size;
      // Completeness as basis points (0-10000 for 0.00% to 100.00%)
      const completenessScore = Math.round(
        (uniqueToppings / TOTAL_UNIQUE_TOPPINGS) * 10000
      );

      holders.push({
        wallet,
        pizzaCount,
        boxCount,
        totalNfts,
        rarityScore,
        uniqueToppings,
        completenessScore,
        ensName: null,
        ensAvatar: null,
      });
    }

    // 6. Resolve ENS (top 500 holders by total NFTs to stay within rate limits)
    const sortedByTotal = [...holders].sort(
      (a, b) => b.totalNfts - a.totalNfts
    );
    const topWallets = sortedByTotal.slice(0, 500).map((h) => h.wallet);

    console.log(
      `[leaderboard] Resolving ENS for top ${topWallets.length} holders...`
    );
    const ensProfiles = await resolveEnsProfiles(topWallets, db);

    for (const holder of holders) {
      const profile = ensProfiles.get(holder.wallet);
      if (profile) {
        holder.ensName = profile.ensName;
        holder.ensAvatar = profile.ensAvatar;
      }
    }

    // 7. Compute ranks
    const byTotal = [...holders].sort((a, b) => b.totalNfts - a.totalNfts);
    const byRarity = [...holders].sort(
      (a, b) => b.rarityScore - a.rarityScore
    );
    const byCompleteness = [...holders].sort(
      (a, b) => b.completenessScore - a.completenessScore
    );

    const rankTotal = new Map<string, number>();
    const rankRarity = new Map<string, number>();
    const rankCompleteness = new Map<string, number>();

    byTotal.forEach((h, i) => rankTotal.set(h.wallet, i + 1));
    byRarity.forEach((h, i) => rankRarity.set(h.wallet, i + 1));
    byCompleteness.forEach((h, i) => rankCompleteness.set(h.wallet, i + 1));

    // 8. Bulk insert holder rows (in batches to avoid query size limits)
    console.log(`[leaderboard] Inserting ${holders.length} holder rows...`);

    const BATCH_SIZE = 200;
    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
      const batch = holders.slice(i, i + BATCH_SIZE);
      await db.insert(leaderboardHolders).values(
        batch.map((h) => ({
          snapshotId,
          wallet: h.wallet,
          pizzaCount: h.pizzaCount,
          boxCount: h.boxCount,
          totalNfts: h.totalNfts,
          rarityScore: h.rarityScore,
          uniqueToppings: h.uniqueToppings,
          completenessScore: h.completenessScore,
          ensName: h.ensName,
          ensAvatar: h.ensAvatar,
          rankByTotal: rankTotal.get(h.wallet) || 0,
          rankByRarity: rankRarity.get(h.wallet) || 0,
          rankByCompleteness: rankCompleteness.get(h.wallet) || 0,
        }))
      );
    }

    // 9. Mark snapshot completed
    const totalTokenCount = allPizzaTokens.length + [...boxOwners.values()].reduce((sum, ids) => sum + ids.length, 0);

    await db
      .update(leaderboardSnapshots)
      .set({
        status: "completed",
        completedAt: new Date(),
        holderCount: allWallets.size,
        tokenCount: totalTokenCount,
      })
      .where(eq(leaderboardSnapshots.id, snapshotId));

    // 10. Prune old snapshots (keep latest 5 completed)
    const completedSnapshots = await db
      .select({ id: leaderboardSnapshots.id })
      .from(leaderboardSnapshots)
      .where(eq(leaderboardSnapshots.status, "completed"))
      .orderBy(desc(leaderboardSnapshots.completedAt));

    if (completedSnapshots.length > 5) {
      const toDelete = completedSnapshots.slice(5);
      for (const snap of toDelete) {
        await db
          .delete(leaderboardSnapshots)
          .where(eq(leaderboardSnapshots.id, snap.id));
      }
    }

    console.log(
      `[leaderboard] Snapshot ${snapshotId} completed: ${allWallets.size} holders, ${totalTokenCount} tokens`
    );

    return snapshotId;
  } catch (error) {
    // Mark as failed
    await db
      .update(leaderboardSnapshots)
      .set({ status: "failed" })
      .where(eq(leaderboardSnapshots.id, snapshotId));

    throw error;
  }
}
