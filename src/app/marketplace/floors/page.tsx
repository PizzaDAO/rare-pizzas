"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import RarityBadge from "@/components/RarityBadge";
import { COLLECTIONS } from "@/lib/collections";
import { getClasses, getAllToppings } from "@/lib/toppings";
import { getImageUrl } from "@/lib/constants";
import type { Rarity } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────

interface FloorData {
  floor: string | null;
  currency: string;
  count: number;
  listing: {
    orderId: string;
    tokenId: string;
    collection: string;
    tokenContract: string;
    chainId: number;
    seller: string;
    price: string;
    currency: string;
  } | null;
}

// ─── Constants ───────────────────────────────────────────────────────

const RARITY_TIERS: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "superrare",
  "epic",
  "grail",
];

// ─── Helpers ─────────────────────────────────────────────────────────

async function fetchFloor(
  params: Record<string, string>
): Promise<FloorData> {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`/api/marketplace/floor?${qs}`);
    if (!res.ok) throw new Error("fetch failed");
    return await res.json();
  } catch {
    return { floor: null, currency: "ETH", count: 0, listing: null };
  }
}

// ─── Collection Floor Card ──────────────────────────────────────────

function CollectionFloorCard({
  name,
  slug,
  data,
  isLoading,
}: {
  name: string;
  slug: string;
  data: FloorData | null;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#333]/50 bg-[#111] p-5 transition-all hover:border-[#FFE135]/50">
      <h3 className="mb-1 text-sm font-semibold text-[#7DD3E8]">{name}</h3>
      {isLoading ? (
        <div className="flex items-center gap-2 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
          <span className="text-xs text-[#555]">Loading...</span>
        </div>
      ) : data?.floor ? (
        <>
          <div className="mb-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#FFE135]">
              {data.floor}
            </span>
            <span className="text-xs text-[#7DD3E8]">{data.currency}</span>
          </div>
          <p className="mb-3 text-xs text-[#555]">
            {data.count} active listing{data.count !== 1 ? "s" : ""}
          </p>
        </>
      ) : (
        <>
          <p className="mb-1 py-2 text-sm text-[#555]">No listings</p>
          <p className="mb-3 text-xs text-[#555]">--</p>
        </>
      )}
      <Link
        href={`/marketplace?collection=${slug}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#7DD3E8] transition-colors hover:text-white"
      >
        Browse
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Rarity Floor Row ───────────────────────────────────────────────

function RarityFloorRow({
  rarity,
  data,
  isLoading,
}: {
  rarity: Rarity;
  data: FloorData | null;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#333]/30 bg-[#111] px-4 py-3 transition-all hover:border-[#FFE135]/30">
      <RarityBadge rarity={rarity} />
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
        </div>
      ) : data?.floor ? (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="font-bold text-[#FFE135]">{data.floor}</span>{" "}
            <span className="text-xs text-[#7DD3E8]">{data.currency}</span>
          </div>
          <span className="min-w-[3rem] text-right text-xs text-[#555]">
            {data.count} listed
          </span>
          <Link
            href={`/marketplace?rarity=${rarity}`}
            className="text-xs font-semibold text-[#7DD3E8] transition-colors hover:text-white"
          >
            Browse
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#555]">No listings</span>
          <Link
            href={`/marketplace?rarity=${rarity}`}
            className="text-xs font-semibold text-[#7DD3E8] transition-colors hover:text-white"
          >
            Browse
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Topping Class Section (expandable) ──────────────────────────────

function ToppingClassSection({
  className: toppingClassName,
  slug,
  classFloor,
  isClassLoading,
}: {
  className: string;
  slug: string;
  classFloor: FloorData | null;
  isClassLoading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [toppingFloors, setToppingFloors] = useState<
    Record<number, FloorData>
  >({});
  const [isToppingLoading, setIsToppingLoading] = useState(false);

  const allToppings = getAllToppings();
  const classToppings = allToppings.filter((t) => t.class === toppingClassName);

  const loadToppingFloors = useCallback(async () => {
    if (Object.keys(toppingFloors).length > 0) return; // already loaded
    setIsToppingLoading(true);
    const results: Record<number, FloorData> = {};
    // Fetch in parallel batches of 10
    for (let i = 0; i < classToppings.length; i += 10) {
      const batch = classToppings.slice(i, i + 10);
      const promises = batch.map(async (t) => {
        const data = await fetchFloor({ topping: String(t.sku) });
        results[t.sku] = data;
      });
      await Promise.all(promises);
    }
    setToppingFloors(results);
    setIsToppingLoading(false);
  }, [classToppings, toppingFloors]);

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      loadToppingFloors();
    }
  };

  return (
    <div className="rounded-xl border border-[#333]/50 bg-[#111] transition-all hover:border-[#FFE135]/30">
      {/* Class header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">{toppingClassName}</h3>
          <span className="text-xs text-[#555]">
            {classToppings.length} topping
            {classToppings.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isClassLoading ? (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
          ) : classFloor?.floor ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#555]">Floor:</span>
              <span className="font-bold text-[#FFE135]">
                {classFloor.floor}
              </span>
              <span className="text-xs text-[#7DD3E8]">
                {classFloor.currency}
              </span>
              <span className="text-xs text-[#555]">
                ({classFloor.count} listed)
              </span>
            </div>
          ) : (
            <span className="text-xs text-[#555]">No listings</span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[#555] transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded toppings list */}
      {isExpanded && (
        <div className="border-t border-[#333]/30 px-5 py-3">
          {isToppingLoading ? (
            <div className="flex items-center gap-2 py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
              <span className="text-xs text-[#555]">
                Loading topping floors...
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {classToppings.map((t) => {
                const floorData = toppingFloors[t.sku];
                return (
                  <div
                    key={t.sku}
                    className="flex items-center justify-between rounded-lg bg-[#0a0a0a] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageUrl(t.image)}
                        alt={t.name}
                        className="h-6 w-6 rounded"
                      />
                      <span className="text-sm text-white">{t.name}</span>
                      <RarityBadge rarity={t.rarity} />
                    </div>
                    <div className="flex items-center gap-3">
                      {floorData?.floor ? (
                        <>
                          <span className="font-bold text-[#FFE135]">
                            {floorData.floor}
                          </span>
                          <span className="text-xs text-[#7DD3E8]">
                            {floorData.currency}
                          </span>
                          <span className="text-xs text-[#555]">
                            {floorData.count} listed
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-[#555]">
                          No listings
                        </span>
                      )}
                      <Link
                        href={`/marketplace?topping=${t.sku}`}
                        className="text-xs font-semibold text-[#7DD3E8] transition-colors hover:text-white"
                      >
                        Browse
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function FloorsPage() {
  const [collectionFloors, setCollectionFloors] = useState<
    Record<string, FloorData>
  >({});
  const [rarityFloors, setRarityFloors] = useState<
    Record<string, FloorData>
  >({});
  const [classFloors, setClassFloors] = useState<
    Record<string, FloorData>
  >({});
  const [isCollectionLoading, setIsCollectionLoading] = useState(true);
  const [isRarityLoading, setIsRarityLoading] = useState(true);
  const [isClassLoading, setIsClassLoading] = useState(true);

  const classes = getClasses();

  // Fetch collection floors
  useEffect(() => {
    async function load() {
      setIsCollectionLoading(true);
      const results: Record<string, FloorData> = {};
      await Promise.all(
        COLLECTIONS.map(async (c) => {
          results[c.slug] = await fetchFloor({ collection: c.slug });
        })
      );
      setCollectionFloors(results);
      setIsCollectionLoading(false);
    }
    load();
  }, []);

  // Fetch rarity floors
  useEffect(() => {
    async function load() {
      setIsRarityLoading(true);
      const results: Record<string, FloorData> = {};
      await Promise.all(
        RARITY_TIERS.map(async (r) => {
          results[r] = await fetchFloor({ rarity: r });
        })
      );
      setRarityFloors(results);
      setIsRarityLoading(false);
    }
    load();
  }, []);

  // Fetch class floors
  useEffect(() => {
    async function load() {
      setIsClassLoading(true);
      const results: Record<string, FloorData> = {};
      await Promise.all(
        classes.map(async (c) => {
          results[c.name] = await fetchFloor({ class: c.name });
        })
      );
      setClassFloors(results);
      setIsClassLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* Header */}
      <section className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Floor Prices
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Live floor prices across collections, rarity tiers, and topping
          classes. Find the cheapest entry points into the PizzaDAO ecosystem.
        </p>
      </section>

      {/* Sub-navigation */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Marketplace
        </Link>
        <Link
          href="/marketplace/list"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FFE135] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          List an NFT
        </Link>
      </div>

      {/* ─── Collection Floors ──────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold text-white">
          Collection Floors
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTIONS.map((c) => (
            <CollectionFloorCard
              key={c.slug}
              name={c.name}
              slug={c.slug}
              data={collectionFloors[c.slug] || null}
              isLoading={isCollectionLoading}
            />
          ))}
        </div>
      </section>

      {/* ─── Rarity Floors ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold text-white">
          Rarity Floors
        </h2>
        <div className="space-y-2">
          {RARITY_TIERS.map((r) => (
            <RarityFloorRow
              key={r}
              rarity={r}
              data={rarityFloors[r] || null}
              isLoading={isRarityLoading}
            />
          ))}
        </div>
      </section>

      {/* ─── Topping Class Floors ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold text-white">
          Topping Floors by Class
        </h2>
        <p className="mb-4 text-sm text-[#7DD3E8]">
          Expand a class to see individual topping floor prices.
        </p>
        <div className="space-y-3">
          {classes.map((c) => (
            <ToppingClassSection
              key={c.slug}
              className={c.name}
              slug={c.slug}
              classFloor={classFloors[c.name] || null}
              isClassLoading={isClassLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
