/**
 * ENS name + avatar resolver with database caching.
 * Uses viem's public client for ENS lookups.
 * Caches results in the ens_cache table for 7 days.
 */

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { ensCache } from "@/db/schema";
import { getPublicClient } from "./viem-client";
import type * as schema from "@/db/schema";

interface EnsProfile {
  ensName: string | null;
  ensAvatar: string | null;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CONCURRENCY_LIMIT = 10;

/**
 * Resolve ENS names + avatars for a list of wallet addresses.
 * Checks the ens_cache table first; only resolves uncached/stale wallets.
 * Returns a Map<wallet (lowercase), EnsProfile>.
 */
export async function resolveEnsProfiles(
  wallets: string[],
  db: NeonHttpDatabase<typeof schema>
): Promise<Map<string, EnsProfile>> {
  const result = new Map<string, EnsProfile>();
  if (wallets.length === 0) return result;

  const lowered = wallets.map((w) => w.toLowerCase());

  // 1. Check cache
  const cached = await db
    .select()
    .from(ensCache)
    .then((rows) => rows);

  const cachedMap = new Map<string, typeof cached[number]>();
  for (const row of cached) {
    cachedMap.set(row.wallet.toLowerCase(), row);
  }

  const cutoff = Date.now() - CACHE_TTL_MS;
  const needsResolve: string[] = [];

  for (const wallet of lowered) {
    const entry = cachedMap.get(wallet);
    if (entry && entry.resolvedAt.getTime() > cutoff) {
      result.set(wallet, {
        ensName: entry.ensName,
        ensAvatar: entry.ensAvatar,
      });
    } else {
      needsResolve.push(wallet);
    }
  }

  if (needsResolve.length === 0) return result;

  // 2. Resolve uncached wallets with concurrency limit
  const client = getPublicClient(1);

  async function resolveOne(wallet: string): Promise<void> {
    try {
      const ensName: string | null = await client.getEnsName({
        address: wallet as `0x${string}`,
      });

      let ensAvatar: string | null = null;
      if (ensName) {
        try {
          ensAvatar = await client.getEnsAvatar({ name: ensName });
        } catch {
          // Avatar resolution can fail — that's OK
        }
      }

      result.set(wallet, { ensName, ensAvatar });

      // Upsert into cache
      await db
        .insert(ensCache)
        .values({
          wallet,
          ensName,
          ensAvatar,
          resolvedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: ensCache.wallet,
          set: {
            ensName,
            ensAvatar,
            resolvedAt: new Date(),
          },
        });
    } catch {
      // If resolution fails, store null so we don't retry immediately
      result.set(wallet, { ensName: null, ensAvatar: null });
    }
  }

  // Process with concurrency limit
  for (let i = 0; i < needsResolve.length; i += CONCURRENCY_LIMIT) {
    const batch = needsResolve.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(batch.map(resolveOne));
  }

  return result;
}
