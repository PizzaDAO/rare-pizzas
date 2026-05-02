"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import CategoryTabs, {
  type SortCategory,
} from "@/components/leaderboard/CategoryTabs";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import type { HolderRow } from "@/components/leaderboard/LeaderboardRow";

const PAGE_SIZE = 50;

interface SnapshotInfo {
  id: string;
  completedAt: string;
}

export default function LeaderboardPage() {
  const { address } = useAccount();

  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [sort, setSort] = useState<SortCategory>("total");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (search) params.set("search", search);

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setHolders(data.holders || []);
      setTotal(data.total || 0);
      setSnapshot(data.snapshot || null);
    } catch {
      setHolders([]);
      setTotal(0);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [sort, offset, search]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Reset offset when sort or search changes
  useEffect(() => {
    setOffset(0);
  }, [sort, search]);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <section className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Leaderboard
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Top Rare Pizzas holders ranked by collection size, rarity score,
          and topping completeness.
        </p>
      </section>

      {/* Last updated */}
      {snapshot && (
        <p className="mb-4 text-center text-xs text-[#555]">
          Last updated:{" "}
          {new Date(snapshot.completedAt).toLocaleString()}
        </p>
      )}

      {/* Category tabs */}
      <div className="mb-6">
        <CategoryTabs active={sort} onChange={setSort} />
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by ENS name or wallet address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-[#7DD3E8] outline-none placeholder:text-[#555] focus:border-[#FFE135]"
        />
      </div>

      {/* Results count */}
      {!loading && total > 0 && (
        <p className="mb-4 text-sm text-[#7DD3E8]">
          Showing {holders.length} of {total.toLocaleString()} holder
          {total !== 1 ? "s" : ""}
        </p>
      )}

      {/* Leaderboard table */}
      <LeaderboardTable
        holders={holders}
        sort={sort}
        currentWallet={address}
        loading={loading}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-[#555]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setOffset(
                Math.min((totalPages - 1) * PAGE_SIZE, offset + PAGE_SIZE)
              )
            }
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
