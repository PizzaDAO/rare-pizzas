"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount, useSwitchChain } from "wagmi";
import { useConnectorClient } from "wagmi";
import { formatEther } from "ethers";
import RarityBadge from "@/components/RarityBadge";
import { getAllToppings } from "@/lib/toppings";
import { getImageUrl } from "@/lib/constants";
import { COLLECTIONS, CHAIN_LABELS, CHAIN_CURRENCIES } from "@/lib/collections";
import {
  createSeaportClient,
  cancelSeaportOrder,
  fulfillSeaportOffer,
  getExplorerTxUrl,
  getExplorerName,
} from "@/lib/seaport";
import type { OrderWithCounter } from "@/lib/seaport";
import type { Rarity } from "@/lib/types";

const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((mod) => mod.ConnectButton),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────────────

interface ListingTopping {
  toppingSku: number;
  rarity: string;
}

interface Listing {
  orderId: string;
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
}

interface Offer {
  offerId: string;
  collection: string;
  tokenContract: string;
  chainId: number;
  tokenId: string | null;
  offerer: string;
  amount: string;
  currency: string;
  expiry: string;
  status: string;
  createdAt: string;
  orderData?: OrderWithCounter;
}

type ActiveTab = "listings" | "incoming" | "outgoing";

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(expiryStr: string): boolean {
  return new Date(expiryStr) < new Date();
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400 bg-green-400/10 border-green-400/30",
  filled: "text-[#7DD3E8] bg-[#7DD3E8]/10 border-[#7DD3E8]/30",
  cancelled: "text-[#555] bg-[#555]/10 border-[#555]/30",
  expired: "text-[#FFE135] bg-[#FFE135]/10 border-[#FFE135]/30",
  accepted: "text-[#7DD3E8] bg-[#7DD3E8]/10 border-[#7DD3E8]/30",
};

// ─── Wallet Prompt ──────────────────────────────────────────────────

function WalletPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FFE135" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
      <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
      <p className="max-w-md text-center text-[#7DD3E8]">
        Connect your wallet to manage your listings and offers.
      </p>
      <ConnectButton />
    </div>
  );
}

// ─── Listing Row ────────────────────────────────────────────────────

function ListingRow({
  listing,
  onCancel,
  onEdit,
  cancelling,
}: {
  listing: Listing;
  onCancel: (listing: Listing) => void;
  onEdit: (listing: Listing) => void;
  cancelling: string | null;
}) {
  const collectionInfo = COLLECTIONS.find((c) => c.slug === listing.collection);
  const allToppings = getAllToppings();
  const toppingNames = listing.toppings
    .map((lt) => allToppings.find((t) => t.sku === lt.toppingSku)?.name)
    .filter(Boolean)
    .slice(0, 3);

  const expired = listing.status === "active" && isExpired(listing.expiry);
  const displayStatus = expired ? "expired" : listing.status;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#333]/50 bg-[#111] p-4">
      {/* NFT thumbnail */}
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-3xl">
        <span role="img" aria-label="pizza">&#127829;</span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs text-[#7DD3E8]">{collectionInfo?.name || listing.collection}</p>
          <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-white">
            {CHAIN_LABELS[listing.chainId]}
          </span>
        </div>
        <h3 className="truncate text-sm font-semibold text-white">#{listing.tokenId}</h3>
        {toppingNames.length > 0 && (
          <p className="text-[10px] text-[#555]">{toppingNames.join(", ")}</p>
        )}
      </div>

      {/* Price */}
      <div className="text-right">
        <p className="text-lg font-bold text-[#FFE135]">{formatPrice(listing.price)}</p>
        <p className="text-xs text-[#7DD3E8]">{listing.currency}</p>
      </div>

      {/* Status badge */}
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[displayStatus] || "text-[#555] bg-[#222]"}`}>
        {displayStatus}
      </span>

      {/* Date */}
      <p className="hidden text-xs text-[#555] sm:block">{formatDate(listing.createdAt)}</p>

      {/* Actions */}
      <div className="flex gap-2">
        {listing.status === "active" && !expired && (
          <>
            <button
              onClick={() => onEdit(listing)}
              className="rounded-lg border border-[#333] px-3 py-1.5 text-xs text-[#7DD3E8] transition-colors hover:border-[#FFE135]/50 hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={() => onCancel(listing)}
              disabled={cancelling === listing.orderId}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            >
              {cancelling === listing.orderId ? "..." : "Cancel"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Offer Row ──────────────────────────────────────────────────────

function IncomingOfferRow({
  offer,
  onAccept,
  onDecline,
  processing,
}: {
  offer: Offer;
  onAccept: (offer: Offer) => void;
  onDecline: (offer: Offer) => void;
  processing: string | null;
}) {
  const collectionInfo = COLLECTIONS.find((c) => c.slug === offer.collection);
  const expired = offer.status === "active" && isExpired(offer.expiry);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#333]/50 bg-[#111] p-4">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-3xl">
        <span role="img" aria-label="pizza">&#127829;</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#7DD3E8]">{collectionInfo?.name || offer.collection}</p>
        <h3 className="text-sm font-semibold text-white">
          {offer.tokenId ? `#${offer.tokenId}` : "Collection Offer"}
        </h3>
        <p className="text-[10px] text-[#555]">From {truncateAddress(offer.offerer)}</p>
      </div>

      <div className="text-right">
        <p className="text-lg font-bold text-[#FFE135]">{formatPrice(offer.amount)}</p>
        <p className="text-xs text-[#7DD3E8]">{offer.currency}</p>
      </div>

      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[expired ? "expired" : offer.status] || "text-[#555] bg-[#222]"}`}>
        {expired ? "expired" : offer.status}
      </span>

      <p className="hidden text-xs text-[#555] sm:block">
        Expires {formatDate(offer.expiry)}
      </p>

      <div className="flex gap-2">
        {offer.status === "active" && !expired && (
          <>
            <button
              onClick={() => onAccept(offer)}
              disabled={processing === offer.offerId}
              className="rounded-lg bg-[#FFE135] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
            >
              {processing === offer.offerId ? "..." : "Accept"}
            </button>
            <button
              onClick={() => onDecline(offer)}
              className="rounded-lg border border-[#333] px-3 py-1.5 text-xs text-[#555] transition-colors hover:border-[#555] hover:text-white"
            >
              Decline
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function OutgoingOfferRow({
  offer,
  onCancel,
  cancelling,
}: {
  offer: Offer;
  onCancel: (offer: Offer) => void;
  cancelling: string | null;
}) {
  const collectionInfo = COLLECTIONS.find((c) => c.slug === offer.collection);
  const expired = offer.status === "active" && isExpired(offer.expiry);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#333]/50 bg-[#111] p-4">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a] text-3xl">
        <span role="img" aria-label="pizza">&#127829;</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#7DD3E8]">{collectionInfo?.name || offer.collection}</p>
        <h3 className="text-sm font-semibold text-white">
          {offer.tokenId ? `#${offer.tokenId}` : "Collection Offer"}
        </h3>
      </div>

      <div className="text-right">
        <p className="text-lg font-bold text-[#FFE135]">{formatPrice(offer.amount)}</p>
        <p className="text-xs text-[#7DD3E8]">{offer.currency}</p>
      </div>

      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[expired ? "expired" : offer.status] || "text-[#555] bg-[#222]"}`}>
        {expired ? "expired" : offer.status}
      </span>

      <p className="hidden text-xs text-[#555] sm:block">
        Expires {formatDate(offer.expiry)}
      </p>

      <div className="flex gap-2">
        {offer.status === "active" && !expired && (
          <button
            onClick={() => onCancel(offer)}
            disabled={cancelling === offer.offerId}
            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50"
          >
            {cancelling === offer.offerId ? "..." : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Empty Tab ──────────────────────────────────────────────────────

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#333]/30 bg-[#111] px-6 py-16 text-center">
      <div className="mb-4 text-5xl">
        <span role="img" aria-label="empty">&#128230;</span>
      </div>
      <p className="text-[#7DD3E8]">{message}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function MyListingsPage() {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("listings");
  const [listings, setListings] = useState<Listing[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<Offer[]>([]);
  const [outgoingOffers, setOutgoingOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingListing, setCancellingListing] = useState<string | null>(null);
  const [cancellingOffer, setCancellingOffer] = useState<string | null>(null);
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      // Fetch my listings
      const listingsRes = await fetch(`/api/marketplace/listings?seller=${address}`);
      if (listingsRes.ok) {
        const data = await listingsRes.json();
        setListings(data.listings || []);
      }

      // Fetch outgoing offers
      const outgoingRes = await fetch(`/api/marketplace/offers?offerer=${address}`);
      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        setOutgoingOffers(data.offers || []);
      }

      // For incoming offers, we'd need to query offers on tokens we own.
      // For now, we'll show a placeholder or query by collection.
      // TODO: This requires knowing which tokens the user owns, then querying offers for those.
      setIncomingOffers([]);
    } catch (err) {
      console.error("Error fetching marketplace data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchData();
    }
  }, [isConnected, address, fetchData]);

  // Cancel listing handler
  const handleCancelListing = useCallback(async (listing: Listing) => {
    if (!address || !connectorClient || !listing.orderData) return;

    setCancellingListing(listing.orderId);
    try {
      // Switch chain if needed
      if (connectedChainId !== listing.chainId) {
        await switchChainAsync({ chainId: listing.chainId });
      }

      // Cancel on-chain
      const provider = connectorClient.transport;
      const seaport = await createSeaportClient(provider, listing.chainId);
      await cancelSeaportOrder(seaport, [listing.orderData.parameters]);

      // Update in DB
      await fetch("/api/marketplace/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: listing.orderId, seller: address }),
      });

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error("Error cancelling listing:", err);
    } finally {
      setCancellingListing(null);
    }
  }, [address, connectorClient, connectedChainId, switchChainAsync, fetchData]);

  // Edit listing (cancel + redirect to list page)
  const handleEditListing = useCallback(async (listing: Listing) => {
    // For now, just cancel and redirect. A pre-filled list page would be a future enhancement.
    await handleCancelListing(listing);
    window.location.href = "/marketplace/list";
  }, [handleCancelListing]);

  // Accept offer handler
  const handleAcceptOffer = useCallback(async (offer: Offer) => {
    if (!address || !connectorClient || !offer.orderData) return;

    setProcessingOffer(offer.offerId);
    try {
      // Switch chain if needed
      if (connectedChainId !== offer.chainId) {
        await switchChainAsync({ chainId: offer.chainId });
      }

      // Fulfill the offer on-chain (seller sends NFT, receives WETH)
      const provider = connectorClient.transport;
      const seaport = await createSeaportClient(provider, offer.chainId);
      const txHash = await fulfillSeaportOffer(seaport, offer.orderData, address);

      // Update in DB
      await fetch("/api/marketplace/offer/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.offerId, txHash }),
      });

      await fetchData();
    } catch (err) {
      console.error("Error accepting offer:", err);
    } finally {
      setProcessingOffer(null);
    }
  }, [address, connectorClient, connectedChainId, switchChainAsync, fetchData]);

  // Decline offer (soft — just hides it)
  const handleDeclineOffer = useCallback(async (offer: Offer) => {
    // Soft decline — mark as cancelled in our DB (off-chain only)
    try {
      await fetch("/api/marketplace/offer/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.offerId, offerer: offer.offerer }),
      });
      await fetchData();
    } catch (err) {
      console.error("Error declining offer:", err);
    }
  }, [fetchData]);

  // Cancel outgoing offer
  const handleCancelOffer = useCallback(async (offer: Offer) => {
    if (!address) return;
    setCancellingOffer(offer.offerId);
    try {
      await fetch("/api/marketplace/offer/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.offerId, offerer: address }),
      });
      await fetchData();
    } catch (err) {
      console.error("Error cancelling offer:", err);
    } finally {
      setCancellingOffer(null);
    }
  }, [address, fetchData]);

  // ─── Render ────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-4">
          <Link href="/marketplace" className="text-sm text-[#7DD3E8] transition-colors hover:text-white">
            &larr; Back to Marketplace
          </Link>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-white">My Listings & Offers</h1>
        <WalletPrompt />
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/marketplace" className="text-sm text-[#7DD3E8] transition-colors hover:text-white">
          &larr; Back to Marketplace
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">My Listings & Offers</h1>
        <Link
          href="/marketplace/list"
          className="rounded-lg bg-[#FFE135] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
        >
          + List an NFT
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[#333]">
        {[
          { key: "listings" as ActiveTab, label: "My Listings", count: listings.length },
          { key: "incoming" as ActiveTab, label: "Incoming Offers", count: incomingOffers.length },
          { key: "outgoing" as ActiveTab, label: "My Offers", count: outgoingOffers.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-[#FFE135] text-[#FFE135]"
                : "border-transparent text-[#7DD3E8] hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-[#222] px-1.5 py-0.5 text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
            <p className="text-[#7DD3E8]">Loading...</p>
          </div>
        </div>
      )}

      {/* My Listings tab */}
      {!isLoading && activeTab === "listings" && (
        <div className="space-y-3">
          {listings.length === 0 ? (
            <EmptyTab message="You don't have any listings yet. List an NFT to get started." />
          ) : (
            listings.map((listing) => (
              <ListingRow
                key={listing.orderId}
                listing={listing}
                onCancel={handleCancelListing}
                onEdit={handleEditListing}
                cancelling={cancellingListing}
              />
            ))
          )}
        </div>
      )}

      {/* Incoming Offers tab */}
      {!isLoading && activeTab === "incoming" && (
        <div className="space-y-3">
          {incomingOffers.length === 0 ? (
            <EmptyTab message="No incoming offers on your NFTs yet." />
          ) : (
            incomingOffers.map((offer) => (
              <IncomingOfferRow
                key={offer.offerId}
                offer={offer}
                onAccept={handleAcceptOffer}
                onDecline={handleDeclineOffer}
                processing={processingOffer}
              />
            ))
          )}
        </div>
      )}

      {/* My Offers tab */}
      {!isLoading && activeTab === "outgoing" && (
        <div className="space-y-3">
          {outgoingOffers.length === 0 ? (
            <EmptyTab message="You haven't made any offers yet." />
          ) : (
            outgoingOffers.map((offer) => (
              <OutgoingOfferRow
                key={offer.offerId}
                offer={offer}
                onCancel={handleCancelOffer}
                cancelling={cancellingOffer}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
