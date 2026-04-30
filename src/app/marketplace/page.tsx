"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import dynamic from "next/dynamic";
import RarityBadge from "@/components/RarityBadge";
import { getAllToppings, getClasses, getRarities } from "@/lib/toppings";
import { getImageUrl } from "@/lib/constants";
import { COLLECTIONS, CHAIN_LABELS } from "@/lib/collections";
import type { Rarity } from "@/lib/types";
import type { OrderWithCounter } from "@/lib/seaport";

// Lazy-load BuyModal and OfferModal (client-only, heavy dependency on seaport/ethers)
const BuyModal = dynamic(() => import("@/components/BuyModal"), { ssr: false });
const OfferModal = dynamic(() => import("@/components/OfferModal"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────

interface ListingTopping {
  toppingSku: number;
  rarity: string;
}

interface Listing {
  orderId: string;
  source?: "opensea" | "local";
  collection: string;
  tokenContract: string;
  chainId: number;
  tokenId: string;
  seller: string;
  price: string;
  currency: string;
  expiry: string;
  status: string;
  createdAt: string;
  orderData?: OrderWithCounter;
  toppings: ListingTopping[];
  imageUrl?: string;
  nftName?: string;
  isBoxOpened?: boolean;
  openseaUrl?: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  superrare: "Super Rare",
  epic: "Epic",
  grail: "Grail",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

const COLLECTION_TABS = [
  { slug: "", label: "All" },
  ...COLLECTIONS.map((c) => ({ slug: c.slug, label: c.name })),
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────

function formatPrice(weiStr: string): string {
  const wei = BigInt(weiStr);
  const eth = Number(wei) / 1e18;
  if (eth < 0.001) return "<0.001";
  return eth.toFixed(eth < 1 ? 4 : 3);
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getOpenseaLink(listing: Listing): string {
  if (listing.openseaUrl) {
    return listing.openseaUrl;
  }
  const chain = listing.chainId === 10 ? "optimism" : "ethereum";
  return `https://opensea.io/assets/${chain}/${listing.tokenContract}/${listing.tokenId}`;
}

/** Check if a listing has valid Seaport order data for on-site buying */
function hasOrderData(listing: Listing): listing is Listing & { orderData: OrderWithCounter } {
  return (
    listing.orderData != null &&
    typeof listing.orderData === "object" &&
    "parameters" in listing.orderData &&
    "signature" in listing.orderData
  );
}

// ─── Listing Card ────────────────────────────────────────────────────

function ListingCard({
  listing,
  onBuyClick,
  onOfferClick,
}: {
  listing: Listing;
  onBuyClick: (listing: Listing) => void;
  onOfferClick: (listing: Listing) => void;
}) {
  const { isConnected } = useAccount();
  const allToppings = getAllToppings();
  const canBuyOnSite = hasOrderData(listing);
  const collectionInfo = COLLECTIONS.find((c) => c.slug === listing.collection);
  const isERC1155 = collectionInfo?.standard === "ERC1155";
  const isBoxCollection = listing.collection === "rare-pizzas-box";

  const toppingDetails = useMemo(() => {
    return listing.toppings
      .map((lt) => allToppings.find((t) => t.sku === lt.toppingSku))
      .filter(Boolean)
      .slice(0, 3);
  }, [listing.toppings, allToppings]);

  const highestRarity = useMemo(() => {
    const order = ["grail", "epic", "superrare", "rare", "uncommon", "common"];
    for (const r of order) {
      if (listing.toppings.some((t) => t.rarity === r)) return r as Rarity;
    }
    return null;
  }, [listing.toppings]);

  return (
    <div className="group rounded-xl border border-[#333]/50 bg-[#111] transition-all hover:border-[#FFE135]/50">
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden rounded-t-xl bg-[#0a0a0a]">
        {listing.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.imageUrl}
            alt={listing.nftName || `#${listing.tokenId}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl">
            <span role="img" aria-label="pizza">&#127829;</span>
          </div>
        )}
        {/* Chain badge */}
        <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          {CHAIN_LABELS[listing.chainId] || `Chain ${listing.chainId}`}
        </div>
        {/* ERC1155 badge */}
        {isERC1155 && (
          <div className="absolute left-2 top-7 rounded-full bg-[#7DD3E8]/20 px-2 py-0.5 text-[10px] font-semibold text-[#7DD3E8]">
            ERC1155
          </div>
        )}
        {/* Box redemption badge */}
        {isBoxCollection && listing.isBoxOpened !== undefined && (
          <div
            className={`absolute left-2 ${isERC1155 ? "top-12" : "top-7"} rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              listing.isBoxOpened
                ? "bg-amber-500/20 text-amber-400"
                : "bg-green-500/20 text-green-400"
            }`}
          >
            {listing.isBoxOpened ? "Opened" : "Unopened"}
          </div>
        )}
        {/* Rarity badge */}
        {highestRarity && (
          <div className="absolute right-2 top-2">
            <RarityBadge rarity={highestRarity} />
          </div>
        )}
        {/* Source indicator */}
        {listing.source && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-[#7DD3E8]">
            {listing.source === "opensea" ? "OpenSea" : "Listed here"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {/* Collection + Token ID */}
        <p className="mb-1 text-xs text-[#7DD3E8]">
          {collectionInfo?.name || listing.collection}
        </p>
        <h3 className="mb-2 truncate text-sm font-semibold text-white">
          {listing.nftName || `#${listing.tokenId}`}
        </h3>

        {/* Top toppings */}
        {toppingDetails.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {toppingDetails.map((t) => (
              <span
                key={t!.sku}
                className="inline-flex items-center gap-1 rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#7DD3E8]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(t!.image)}
                  alt={t!.name}
                  className="h-3 w-3 rounded-full"
                />
                {t!.name}
              </span>
            ))}
            {listing.toppings.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#555]">
                +{listing.toppings.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-lg font-bold text-[#FFE135]">
            {formatPrice(listing.price)}
          </span>
          <span className="text-xs text-[#7DD3E8]">{listing.currency}</span>
        </div>

        {/* Seller */}
        <p className="mb-3 text-[10px] text-[#555]">
          Listed by {truncateAddress(listing.seller)}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {/* Buy Now button — only if we have valid Seaport order data (local listing) */}
          {canBuyOnSite && (
            <button
              onClick={() => onBuyClick(listing)}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#FFE135] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
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
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Buy Now
            </button>
          )}

          {/* Make Offer button */}
          <button
            onClick={() => onOfferClick(listing)}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#7DD3E8]/30 px-4 py-2 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#7DD3E8] hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Make Offer
          </button>

          {/* Buy on OpenSea / View on OpenSea */}
          <a
            href={getOpenseaLink(listing)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              canBuyOnSite
                ? "border border-[#333] bg-[#0a0a0a] text-[#7DD3E8] hover:border-[#555] hover:text-white"
                : "bg-[#FFE135] text-black hover:bg-[#FFE135]/80"
            }`}
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
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {canBuyOnSite ? "View on OpenSea" : "Buy on OpenSea"}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#333]/30 bg-[#111] px-6 py-20">
      <div className="mb-6 text-7xl">
        <span role="img" aria-label="pizza marketplace">&#127829;</span>
      </div>
      <h2 className="mb-3 text-2xl font-bold text-white">No listings yet</h2>
      <p className="mb-6 max-w-md text-center text-[#7DD3E8]">
        The PizzaDAO marketplace is launching soon. You&apos;ll be able to browse,
        filter, and trade PizzaDAO NFTs by their toppings -- something no other
        marketplace can do.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {COLLECTIONS.map((c) => (
          <a
            key={c.slug}
            href={c.opensea}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-2 text-sm text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white"
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
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {c.name} on OpenSea
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Marketplace Content ─────────────────────────────────────────────

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filters from URL
  const activeCollection = searchParams.get("collection") || "";
  const activeRarity = searchParams.get("rarity") || "";
  const activeTopping = searchParams.get("topping") || "";
  const activeChain = searchParams.get("chain") || "";
  const activeSort = searchParams.get("sort") || "newest";
  const searchQuery = searchParams.get("search") || "";

  // Data
  const [listingsData, setListingsData] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buy modal state
  const [buyListing, setBuyListing] = useState<Listing | null>(null);
  // Offer modal state
  const [offerListing, setOfferListing] = useState<Listing | null>(null);

  // Floor price state
  const [floorPrice, setFloorPrice] = useState<string | null>(null);
  const [floorCurrency, setFloorCurrency] = useState("ETH");
  const [floorCount, setFloorCount] = useState(0);
  const [isFloorLoading, setIsFloorLoading] = useState(false);

  const classes = getClasses();
  const rarities = getRarities();
  const allToppings = getAllToppings();

  // Filter toppings dropdown by search
  const filteredToppings = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return allToppings
      .filter((t) => t.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [allToppings, searchQuery]);

  // Update URL params
  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeCollection) params.set("collection", activeCollection);
      if (activeRarity) params.set("rarity", activeRarity);
      if (activeTopping) params.set("topping", activeTopping);
      if (activeChain) params.set("chain", activeChain);
      if (activeSort) params.set("sort", activeSort);

      const res = await fetch(`/api/marketplace/listings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch listings");

      const data = await res.json();
      setListingsData(data.listings || []);
      setTotal(data.total || 0);
    } catch (err) {
      // If API is unavailable (e.g., no DATABASE_URL), show empty state gracefully
      setListingsData([]);
      setTotal(0);
      setError(null); // Don't show error for expected empty state
    } finally {
      setIsLoading(false);
    }
  }, [activeCollection, activeRarity, activeTopping, activeChain, activeSort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Fetch floor price for current filters
  useEffect(() => {
    async function loadFloor() {
      setIsFloorLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeCollection) params.set("collection", activeCollection);
        if (activeTopping) params.set("topping", activeTopping);
        // Only include rarity/class for floor context if they are set
        if (activeRarity) params.set("rarity", activeRarity);

        const res = await fetch(`/api/marketplace/floor?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setFloorPrice(data.floor ?? null);
          setFloorCurrency(data.currency || "ETH");
          setFloorCount(data.count || 0);
        } else {
          setFloorPrice(null);
          setFloorCount(0);
        }
      } catch {
        setFloorPrice(null);
        setFloorCount(0);
      } finally {
        setIsFloorLoading(false);
      }
    }
    loadFloor();
  }, [activeCollection, activeTopping, activeRarity]);

  // Handle Buy Now click
  const handleBuyClick = useCallback((listing: Listing) => {
    setBuyListing(listing);
  }, []);

  // Handle Buy Now success — refresh listings to reflect status change
  const handleBuySuccess = useCallback(() => {
    fetchListings();
  }, [fetchListings]);

  // Handle Make Offer click
  const handleOfferClick = useCallback((listing: Listing) => {
    setOfferListing(listing);
  }, []);

  return (
    <>
      {/* Header */}
      <section className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Marketplace
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Browse and trade PizzaDAO NFTs. Filter by rarity, class, and
          specific toppings across all collections.
        </p>
      </section>

      {/* Sub-navigation */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/marketplace/list"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FFE135] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          List an NFT
        </Link>
        <Link
          href="/marketplace/my-listings"
          className="inline-flex items-center gap-2 rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          My Listings & Offers
        </Link>
        <Link
          href="/marketplace/floors"
          className="inline-flex items-center gap-2 rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Floor Prices
        </Link>
      </div>

      {/* Collection Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {COLLECTION_TABS.map((tab) => (
          <button
            key={tab.slug}
            onClick={() => updateParam("collection", tab.slug)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeCollection === tab.slug
                ? "bg-[#FFE135] text-black"
                : "border border-[#333] bg-[#111] text-[#7DD3E8] hover:border-[#FFE135]/50 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Class filter */}
        <select
          value=""
          onChange={(e) => {
            // Find a topping in this class and filter by it
            // For now, just use as a visual grouping hint
            updateParam("class", e.target.value);
          }}
          className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.slug} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Rarity filter */}
        <select
          value={activeRarity}
          onChange={(e) => updateParam("rarity", e.target.value)}
          className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
        >
          <option value="">All Rarities</option>
          {rarities.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r] || r}
            </option>
          ))}
        </select>

        {/* Chain filter */}
        <select
          value={activeChain}
          onChange={(e) => updateParam("chain", e.target.value)}
          className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
        >
          <option value="">All Chains</option>
          {Object.entries(CHAIN_LABELS).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        {/* Topping search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search toppings..."
            value={searchQuery}
            onChange={(e) => updateParam("search", e.target.value)}
            className="rounded-lg border border-[#333] bg-[#111] px-3 py-2 text-sm text-[#7DD3E8] outline-none placeholder:text-[#555] focus:border-[#FFE135]"
          />
          {filteredToppings.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-[#333] bg-[#111] shadow-xl">
              {filteredToppings.map((t) => (
                <button
                  key={t.sku}
                  onClick={() => {
                    updateParam("topping", String(t.sku));
                    updateParam("search", "");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#7DD3E8] transition-colors hover:bg-[#222] hover:text-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(t.image)}
                    alt={t.name}
                    className="h-6 w-6 rounded"
                  />
                  <span>{t.name}</span>
                  <RarityBadge rarity={t.rarity} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active topping filter chip */}
        {activeTopping && (
          <button
            onClick={() => updateParam("topping", "")}
            className="inline-flex items-center gap-1 rounded-full bg-[#FFE135]/20 px-3 py-1 text-xs font-semibold text-[#FFE135]"
          >
            Topping: {allToppings.find((t) => t.sku === Number(activeTopping))?.name || activeTopping}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Sort */}
        <div className="ml-auto">
          <select
            value={activeSort}
            onChange={(e) => updateParam("sort", e.target.value)}
            className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floor Price Indicator */}
      {!isFloorLoading && floorPrice && (
        <div className="mb-4 inline-flex items-center gap-3 rounded-lg border border-[#FFE135]/30 bg-[#FFE135]/5 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#555]">
            {activeTopping
              ? `${allToppings.find((t) => t.sku === Number(activeTopping))?.name || "Topping"} Floor`
              : activeCollection
                ? `${COLLECTIONS.find((c) => c.slug === activeCollection)?.name || "Collection"} Floor`
                : activeRarity
                  ? `${RARITY_LABELS[activeRarity] || activeRarity} Floor`
                  : "Floor"}
          </span>
          <span className="text-lg font-bold text-[#FFE135]">{floorPrice}</span>
          <span className="text-xs text-[#7DD3E8]">{floorCurrency}</span>
          <span className="text-xs text-[#555]">
            ({floorCount} listing{floorCount !== 1 ? "s" : ""})
          </span>
        </div>
      )}

      {/* Results count */}
      {!isLoading && total > 0 && (
        <p className="mb-4 text-sm text-[#7DD3E8]">
          Showing {listingsData.length} of {total} listing{total !== 1 ? "s" : ""}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
            <p className="text-[#7DD3E8]">Loading marketplace...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Listings Grid or Empty State */}
      {!isLoading && !error && listingsData.length === 0 && <EmptyState />}

      {!isLoading && listingsData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listingsData.map((listing) => (
            <ListingCard
              key={listing.orderId}
              listing={listing}
              onBuyClick={handleBuyClick}
              onOfferClick={handleOfferClick}
            />
          ))}
        </div>
      )}

      {/* Buy Modal */}
      {buyListing && hasOrderData(buyListing) && (
        <BuyModal
          listing={buyListing as Listing & { orderData: OrderWithCounter }}
          onClose={() => setBuyListing(null)}
          onSuccess={handleBuySuccess}
        />
      )}

      {/* Offer Modal */}
      {offerListing && (
        <OfferModal
          target={{
            collection: offerListing.collection,
            tokenContract: offerListing.tokenContract,
            chainId: offerListing.chainId,
            tokenId: offerListing.tokenId,
            toppings: offerListing.toppings,
          }}
          onClose={() => setOfferListing(null)}
          onSuccess={() => {
            setOfferListing(null);
          }}
        />
      )}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  return (
    <div>
      <Suspense>
        <MarketplaceContent />
      </Suspense>
    </div>
  );
}
