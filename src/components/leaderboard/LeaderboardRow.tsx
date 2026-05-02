"use client";

import HolderAvatar from "./HolderAvatar";
import type { SortCategory } from "./CategoryTabs";

export interface HolderRow {
  wallet: string;
  pizzaCount: number;
  boxCount: number;
  totalNfts: number;
  rarityScore: number;
  uniqueToppings: number;
  completenessScore: number; // 0-10000
  ensName: string | null;
  ensAvatar: string | null;
  rankByTotal: number | null;
  rankByRarity: number | null;
  rankByCompleteness: number | null;
}

interface LeaderboardRowProps {
  holder: HolderRow;
  sort: SortCategory;
  isCurrentUser: boolean;
}

function getRank(holder: HolderRow, sort: SortCategory): number {
  switch (sort) {
    case "rarity":
      return holder.rankByRarity || 0;
    case "completeness":
      return holder.rankByCompleteness || 0;
    default:
      return holder.rankByTotal || 0;
  }
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FFD700]/20 text-sm font-bold text-[#FFD700]">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#C0C0C0]/20 text-sm font-bold text-[#C0C0C0]">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#CD7F32]/20 text-sm font-bold text-[#CD7F32]">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center text-sm text-[#555]">
      {rank}
    </span>
  );
}

function formatCompleteness(score: number): string {
  return (score / 100).toFixed(2) + "%";
}

/** Desktop table row */
export function LeaderboardRowDesktop({
  holder,
  sort,
  isCurrentUser,
}: LeaderboardRowProps) {
  const rank = getRank(holder, sort);

  return (
    <tr
      className={`border-b border-[#222] transition-colors hover:bg-[#111] ${
        isCurrentUser ? "border-l-4 border-l-[#FFE135] bg-[#FFE135]/5" : ""
      }`}
    >
      <td className="px-4 py-3">
        <RankBadge rank={rank} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <HolderAvatar
            wallet={holder.wallet}
            ensAvatar={holder.ensAvatar}
            size={36}
          />
          <div className="min-w-0">
            {holder.ensName ? (
              <>
                <p className="truncate text-sm font-medium text-white">
                  {holder.ensName}
                </p>
                <p className="text-xs text-[#555]">
                  {truncateAddress(holder.wallet)}
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-white">
                {truncateAddress(holder.wallet)}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-sm text-[#7DD3E8]">
        {holder.pizzaCount}
      </td>
      <td className="px-4 py-3 text-center text-sm text-[#7DD3E8]">
        {holder.boxCount}
      </td>
      <td className="px-4 py-3 text-center text-sm font-semibold text-white">
        {holder.totalNfts}
      </td>
      <td className="px-4 py-3 text-center text-sm text-[#FFE135]">
        {holder.rarityScore.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-center text-sm text-[#7DD3E8]">
        {holder.uniqueToppings}
        <span className="ml-1 text-xs text-[#555]">
          ({formatCompleteness(holder.completenessScore)})
        </span>
      </td>
    </tr>
  );
}

/** Mobile card layout */
export function LeaderboardRowMobile({
  holder,
  sort,
  isCurrentUser,
}: LeaderboardRowProps) {
  const rank = getRank(holder, sort);

  return (
    <div
      className={`rounded-xl border border-[#333]/50 bg-[#111] p-4 ${
        isCurrentUser ? "border-l-4 border-l-[#FFE135]" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <RankBadge rank={rank} />
        <HolderAvatar
          wallet={holder.wallet}
          ensAvatar={holder.ensAvatar}
          size={36}
        />
        <div className="min-w-0 flex-1">
          {holder.ensName ? (
            <>
              <p className="truncate text-sm font-medium text-white">
                {holder.ensName}
              </p>
              <p className="text-xs text-[#555]">
                {truncateAddress(holder.wallet)}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-white">
              {truncateAddress(holder.wallet)}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[#0a0a0a] px-3 py-2">
          <span className="text-[#555]">Pizzas</span>
          <span className="ml-2 font-medium text-[#7DD3E8]">
            {holder.pizzaCount}
          </span>
        </div>
        <div className="rounded-lg bg-[#0a0a0a] px-3 py-2">
          <span className="text-[#555]">Boxes</span>
          <span className="ml-2 font-medium text-[#7DD3E8]">
            {holder.boxCount}
          </span>
        </div>
        <div className="rounded-lg bg-[#0a0a0a] px-3 py-2">
          <span className="text-[#555]">Total</span>
          <span className="ml-2 font-semibold text-white">
            {holder.totalNfts}
          </span>
        </div>
        <div className="rounded-lg bg-[#0a0a0a] px-3 py-2">
          <span className="text-[#555]">Rarity</span>
          <span className="ml-2 font-medium text-[#FFE135]">
            {holder.rarityScore.toLocaleString()}
          </span>
        </div>
        <div className="col-span-2 rounded-lg bg-[#0a0a0a] px-3 py-2">
          <span className="text-[#555]">Toppings</span>
          <span className="ml-2 font-medium text-[#7DD3E8]">
            {holder.uniqueToppings}
          </span>
          <span className="ml-1 text-[#555]">
            ({formatCompleteness(holder.completenessScore)})
          </span>
        </div>
      </div>
    </div>
  );
}
