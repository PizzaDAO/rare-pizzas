/**
 * Run leaderboard snapshot locally.
 * Usage: node scripts/run-snapshot.mjs
 * Requires DATABASE_URL and ALCHEMY_API_KEY in .env.local
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local ─────────────────────────────────────────────────
const envPath = resolve(__dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.log("No .env.local found, using existing env vars");
}

// ─── Inline schema (to avoid @/ alias issues) ───────────────────────

const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  holderCount: integer("holder_count"),
  tokenCount: integer("token_count"),
});

const leaderboardHolders = pgTable(
  "leaderboard_holders",
  {
    snapshotId: text("snapshot_id").notNull(),
    wallet: text("wallet").notNull(),
    pizzaCount: integer("pizza_count").notNull().default(0),
    boxCount: integer("box_count").notNull().default(0),
    totalNfts: integer("total_nfts").notNull().default(0),
    rarityScore: integer("rarity_score").notNull().default(0),
    uniqueToppings: integer("unique_toppings").notNull().default(0),
    completenessScore: integer("completeness_score").notNull().default(0),
    ensName: text("ens_name"),
    ensAvatar: text("ens_avatar"),
    rankByTotal: integer("rank_by_total"),
    rankByRarity: integer("rank_by_rarity"),
    rankByCompleteness: integer("rank_by_completeness"),
  },
  (table) => [primaryKey({ columns: [table.snapshotId, table.wallet] })]
);

const ensCache = pgTable("ens_cache", {
  wallet: text("wallet").primaryKey(),
  ensName: text("ens_name"),
  ensAvatar: text("ens_avatar"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Topping data ───────────────────────────────────────────────────

const toppingsJsonPath = resolve(__dirname, "..", "src", "data", "toppings.json");
const toppingsData = JSON.parse(readFileSync(toppingsJsonPath, "utf-8"));

const EXCLUDED_TRAIT_TYPES = new Set(["Pizza Recipe", "Box", "Paper"]);

const RARITY_WEIGHTS = {
  common: 1,
  uncommon: 3,
  rare: 10,
  superrare: 25,
  epic: 75,
  grail: 300,
};

const TOTAL_UNIQUE_TOPPINGS = 337;

// Build lookup
const toppingLookup = new Map();
for (const t of toppingsData) {
  const key = `${t.class.toLowerCase().trim()}:${t.name.toLowerCase().trim()}`;
  toppingLookup.set(key, t);
}

function matchTopping(attr) {
  if (EXCLUDED_TRAIT_TYPES.has(attr.trait_type)) return null;
  const className = String(attr.trait_type).toLowerCase().trim();
  const name = String(attr.value).toLowerCase().trim();
  const exact = toppingLookup.get(`${className}:${name}`);
  if (exact) return exact;
  // Partial match
  for (const t of toppingsData) {
    if (t.class.toLowerCase() !== className) continue;
    const tName = t.name.toLowerCase();
    if (tName.includes(name) || name.includes(tName)) return t;
  }
  return null;
}

// ─── Alchemy API ────────────────────────────────────────────────────

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
if (!ALCHEMY_KEY) throw new Error("ALCHEMY_API_KEY not set");
const ALCHEMY_BASE = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

async function getOwnersForContract(contractAddress) {
  const owners = new Map();
  let pageKey;
  do {
    const url = new URL(`${ALCHEMY_BASE}/getOwnersForContract`);
    url.searchParams.set("contractAddress", contractAddress);
    url.searchParams.set("withTokenBalances", "true");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Alchemy error ${res.status}: ${await res.text()}`);
    const data = await res.json();

    for (const owner of data.owners) {
      const wallet = owner.ownerAddress.toLowerCase();
      const existing = owners.get(wallet) || [];
      for (const tb of owner.tokenBalances) existing.push(tb.tokenId);
      owners.set(wallet, existing);
    }
    pageKey = data.pageKey;
  } while (pageKey);
  return owners;
}

async function getNftMetadataBatch(tokens) {
  const results = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    if (i > 0 && i % 500 === 0) {
      console.log(`  ... fetched metadata for ${i}/${tokens.length} tokens`);
    }
    const res = await fetch(`${ALCHEMY_BASE}/getNFTMetadataBatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: batch }),
    });
    if (!res.ok) throw new Error(`Alchemy batch error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const nfts = data.nfts || data;
    for (const nft of nfts) {
      results.push({
        contractAddress: nft.contract.address.toLowerCase(),
        tokenId: nft.tokenId,
        attributes: nft.raw?.metadata?.attributes || [],
      });
    }
  }
  return results;
}

// ─── ENS resolution (via viem public client) ────────────────────────

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const viemClient = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

const ENS_CONCURRENCY = 10;
const ENS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function resolveEnsProfiles(wallets, db) {
  const result = new Map();
  if (wallets.length === 0) return result;

  const lowered = wallets.map((w) => w.toLowerCase());

  // Check cache
  const cached = await db.select().from(ensCache);
  const cachedMap = new Map();
  for (const row of cached) cachedMap.set(row.wallet.toLowerCase(), row);

  const cutoff = Date.now() - ENS_CACHE_TTL_MS;
  const needsResolve = [];

  for (const wallet of lowered) {
    const entry = cachedMap.get(wallet);
    if (entry && entry.resolvedAt.getTime() > cutoff) {
      result.set(wallet, { ensName: entry.ensName, ensAvatar: entry.ensAvatar });
    } else {
      needsResolve.push(wallet);
    }
  }

  if (needsResolve.length === 0) return result;

  console.log(`  Resolving ${needsResolve.length} uncached ENS names...`);

  async function resolveOne(wallet) {
    try {
      const ensName = await viemClient.getEnsName({ address: wallet });
      let ensAvatar = null;
      if (ensName) {
        try {
          ensAvatar = await viemClient.getEnsAvatar({ name: ensName });
        } catch {}
      }
      result.set(wallet, { ensName, ensAvatar });
      await db
        .insert(ensCache)
        .values({ wallet, ensName, ensAvatar, resolvedAt: new Date() })
        .onConflictDoUpdate({
          target: ensCache.wallet,
          set: { ensName, ensAvatar, resolvedAt: new Date() },
        });
    } catch {
      result.set(wallet, { ensName: null, ensAvatar: null });
    }
  }

  for (let i = 0; i < needsResolve.length; i += ENS_CONCURRENCY) {
    const batch = needsResolve.slice(i, i + ENS_CONCURRENCY);
    await Promise.all(batch.map(resolveOne));
    if (i > 0 && i % 50 === 0) {
      console.log(`  ... resolved ${i}/${needsResolve.length} ENS names`);
    }
  }

  return result;
}

// ─── Main pipeline ──────────────────────────────────────────────────

const RARE_PIZZAS_CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0";
const RARE_PIZZAS_BOX_CONTRACT = "0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7";

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const snapshotId = crypto.randomUUID();
  console.log(`Snapshot ${snapshotId}`);

  await db.insert(leaderboardSnapshots).values({ id: snapshotId, status: "running" });

  try {
    // Fetch owners
    console.log("Fetching pizza owners...");
    const pizzaOwners = await getOwnersForContract(RARE_PIZZAS_CONTRACT);
    console.log("Fetching box owners...");
    const boxOwners = await getOwnersForContract(RARE_PIZZAS_BOX_CONTRACT);

    const allWallets = new Set([...pizzaOwners.keys(), ...boxOwners.keys()]);
    console.log(
      `Found ${allWallets.size} unique holders (${pizzaOwners.size} pizza, ${boxOwners.size} box)`
    );

    // Fetch metadata for all pizza tokens
    const allPizzaTokens = [];
    for (const [, tokenIds] of pizzaOwners) {
      for (const tokenId of tokenIds) {
        allPizzaTokens.push({ contractAddress: RARE_PIZZAS_CONTRACT, tokenId });
      }
    }

    console.log(`Fetching metadata for ${allPizzaTokens.length} pizza tokens...`);
    const metadataResults = await getNftMetadataBatch(allPizzaTokens);

    const tokenMetadata = new Map();
    for (const m of metadataResults) tokenMetadata.set(m.tokenId, m.attributes);

    // Compute scores
    console.log("Computing scores...");
    const holders = [];
    for (const wallet of allWallets) {
      const pizzaTokenIds = pizzaOwners.get(wallet) || [];
      const boxTokenIds = boxOwners.get(wallet) || [];
      const pizzaCount = pizzaTokenIds.length;
      const boxCount = boxTokenIds.length;
      const totalNfts = pizzaCount + boxCount;

      let rarityScore = 0;
      const seenSku = new Set();
      for (const tokenId of pizzaTokenIds) {
        const attributes = tokenMetadata.get(tokenId) || [];
        for (const attr of attributes) {
          const topping = matchTopping(attr);
          if (topping) {
            rarityScore += RARITY_WEIGHTS[topping.rarity] || 1;
            seenSku.add(topping.sku);
          }
        }
      }

      holders.push({
        wallet,
        pizzaCount,
        boxCount,
        totalNfts,
        rarityScore,
        uniqueToppings: seenSku.size,
        completenessScore: Math.round((seenSku.size / TOTAL_UNIQUE_TOPPINGS) * 10000),
        ensName: null,
        ensAvatar: null,
      });
    }

    // ENS resolution (top 500)
    const sortedByTotal = [...holders].sort((a, b) => b.totalNfts - a.totalNfts);
    const topWallets = sortedByTotal.slice(0, 500).map((h) => h.wallet);
    console.log(`Resolving ENS for top ${topWallets.length} holders...`);
    const ensProfiles = await resolveEnsProfiles(topWallets, db);

    for (const holder of holders) {
      const profile = ensProfiles.get(holder.wallet);
      if (profile) {
        holder.ensName = profile.ensName;
        holder.ensAvatar = profile.ensAvatar;
      }
    }

    // Compute ranks
    const byTotal = [...holders].sort((a, b) => b.totalNfts - a.totalNfts);
    const byRarity = [...holders].sort((a, b) => b.rarityScore - a.rarityScore);
    const byComp = [...holders].sort((a, b) => b.completenessScore - a.completenessScore);

    const rankTotal = new Map();
    const rankRarity = new Map();
    const rankComp = new Map();
    byTotal.forEach((h, i) => rankTotal.set(h.wallet, i + 1));
    byRarity.forEach((h, i) => rankRarity.set(h.wallet, i + 1));
    byComp.forEach((h, i) => rankComp.set(h.wallet, i + 1));

    // Insert holders
    console.log(`Inserting ${holders.length} holder rows...`);
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
          rankByCompleteness: rankComp.get(h.wallet) || 0,
        }))
      );
    }

    // Mark completed
    const totalTokenCount =
      allPizzaTokens.length +
      [...boxOwners.values()].reduce((sum, ids) => sum + ids.length, 0);

    await db
      .update(leaderboardSnapshots)
      .set({
        status: "completed",
        completedAt: new Date(),
        holderCount: allWallets.size,
        tokenCount: totalTokenCount,
      })
      .where(eq(leaderboardSnapshots.id, snapshotId));

    // Prune old snapshots
    const completed = await db
      .select({ id: leaderboardSnapshots.id })
      .from(leaderboardSnapshots)
      .where(eq(leaderboardSnapshots.status, "completed"))
      .orderBy(desc(leaderboardSnapshots.completedAt));

    if (completed.length > 5) {
      for (const snap of completed.slice(5)) {
        await db
          .delete(leaderboardSnapshots)
          .where(eq(leaderboardSnapshots.id, snap.id));
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `\nSnapshot completed in ${elapsed}s: ${snapshotId}`
    );
    console.log(`  ${allWallets.size} holders, ${totalTokenCount} tokens`);

    // Show top 5
    const top5 = byTotal.slice(0, 5);
    console.log("\nTop 5 by total NFTs:");
    for (const h of top5) {
      const name = h.ensName || h.wallet.slice(0, 10) + "...";
      console.log(
        `  #${rankTotal.get(h.wallet)} ${name} — ${h.totalNfts} NFTs (${h.pizzaCount}P + ${h.boxCount}B), rarity: ${h.rarityScore}, toppings: ${h.uniqueToppings}`
      );
    }
  } catch (error) {
    await db
      .update(leaderboardSnapshots)
      .set({ status: "failed" })
      .where(eq(leaderboardSnapshots.id, snapshotId));
    throw error;
  }
}

const start = Date.now();
main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
