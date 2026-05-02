"use client";

import {
  LeaderboardRowDesktop,
  LeaderboardRowMobile,
  type HolderRow,
} from "./LeaderboardRow";
import type { SortCategory } from "./CategoryTabs";

interface LeaderboardTableProps {
  holders: HolderRow[];
  sort: SortCategory;
  currentWallet: string | undefined;
  loading: boolean;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-[#111] border border-[#222]"
        />
      ))}
    </div>
  );
}

export default function LeaderboardTable({
  holders,
  sort,
  currentWallet,
  loading,
}: LeaderboardTableProps) {
  if (loading) return <LoadingSkeleton />;

  if (holders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#333]/30 bg-[#111] px-6 py-20">
        <div className="mb-6 text-7xl">
          <span role="img" aria-label="pizza leaderboard">&#127829;</span>
        </div>
        <h2 className="mb-3 text-2xl font-bold text-white">
          No leaderboard data yet
        </h2>
        <p className="max-w-md text-center text-[#7DD3E8]">
          The leaderboard will be populated once the first snapshot runs.
          Check back soon!
        </p>
      </div>
    );
  }

  const walletLower = currentWallet?.toLowerCase();

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#333] text-xs uppercase tracking-wider text-[#555]">
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Holder</th>
              <th className="px-4 py-3 text-center">Pizzas</th>
              <th className="px-4 py-3 text-center">Boxes</th>
              <th className="px-4 py-3 text-center">Total</th>
              <th className="px-4 py-3 text-center">Rarity Score</th>
              <th className="px-4 py-3 text-center">Unique Toppings</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((holder) => (
              <LeaderboardRowDesktop
                key={holder.wallet}
                holder={holder}
                sort={sort}
                isCurrentUser={
                  !!walletLower && holder.wallet.toLowerCase() === walletLower
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {holders.map((holder) => (
          <LeaderboardRowMobile
            key={holder.wallet}
            holder={holder}
            sort={sort}
            isCurrentUser={
              !!walletLower && holder.wallet.toLowerCase() === walletLower
            }
          />
        ))}
      </div>
    </>
  );
}
