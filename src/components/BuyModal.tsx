"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useConnectorClient } from "wagmi";
import Image from "next/image";
import RarityBadge from "@/components/RarityBadge";
import { getAllToppings } from "@/lib/toppings";
import { getImageUrl } from "@/lib/constants";
import { COLLECTIONS, CHAIN_LABELS } from "@/lib/collections";
import {
  MARKETPLACE_FEE_BPS,
  CREATOR_ROYALTY_BPS,
  calculateTotalWithFees,
  bpsToPercent,
} from "@/lib/marketplace-config";
import {
  createSeaportClient,
  fulfillSeaportOrder,
  getExplorerTxUrl,
  getExplorerName,
} from "@/lib/seaport";
import type { OrderWithCounter } from "@/lib/seaport";
import type { Rarity } from "@/lib/types";

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
  orderData: OrderWithCounter;
  toppings: ListingTopping[];
}

type BuyState =
  | { status: "idle" }
  | { status: "switching-chain" }
  | { status: "confirming" }
  | { status: "pending"; hash: string }
  | { status: "success"; hash: string }
  | { status: "error"; message: string };

interface BuyModalProps {
  listing: Listing;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatEth(weiStr: string): string {
  const wei = BigInt(weiStr);
  const eth = Number(wei) / 1e18;
  if (eth < 0.0001) return "<0.0001";
  if (eth < 1) return eth.toFixed(4);
  return eth.toFixed(3);
}

function formatEthPrecise(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth < 0.0001) return "<0.0001";
  if (eth < 0.01) return eth.toFixed(6);
  if (eth < 1) return eth.toFixed(4);
  return eth.toFixed(3);
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Component ───────────────────────────────────────────────────────

export default function BuyModal({ listing, onClose, onSuccess }: BuyModalProps) {
  const { address, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();

  const [buyState, setBuyState] = useState<BuyState>({ status: "idle" });

  const allToppings = getAllToppings();
  const collectionInfo = COLLECTIONS.find((c) => c.slug === listing.collection);
  const isERC1155 = collectionInfo?.standard === "ERC1155";
  const needsChainSwitch = connectedChainId !== listing.chainId;

  // Price breakdown
  const priceBreakdown = useMemo(() => {
    return calculateTotalWithFees(BigInt(listing.price));
  }, [listing.price]);

  // Top toppings for display
  const toppingDetails = useMemo(() => {
    return listing.toppings
      .map((lt) => {
        const t = allToppings.find((t) => t.sku === lt.toppingSku);
        return t ? { ...t, listingRarity: lt.rarity } : null;
      })
      .filter(Boolean);
  }, [listing.toppings, allToppings]);

  // Highest rarity
  const highestRarity = useMemo(() => {
    const order = ["grail", "epic", "superrare", "rare", "uncommon", "common"];
    for (const r of order) {
      if (listing.toppings.some((t) => t.rarity === r)) return r as Rarity;
    }
    return null;
  }, [listing.toppings]);

  // Close on escape key
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && buyState.status !== "pending") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, buyState.status]);

  // ─── Buy handler ─────────────────────────────────────────────────

  const handleBuy = useCallback(async () => {
    if (!address || !connectorClient) {
      setBuyState({ status: "error", message: "Please connect your wallet first." });
      return;
    }

    try {
      // Step 1: Switch chain if needed
      if (needsChainSwitch) {
        setBuyState({ status: "switching-chain" });
        try {
          await switchChainAsync({ chainId: listing.chainId });
        } catch {
          setBuyState({
            status: "error",
            message: `Please switch to ${CHAIN_LABELS[listing.chainId] || "the correct chain"} to complete this purchase.`,
          });
          return;
        }
      }

      // Step 2: Create Seaport client and fulfill
      setBuyState({ status: "confirming" });

      const provider = connectorClient.transport;
      const seaport = await createSeaportClient(provider, listing.chainId);
      const txHash = await fulfillSeaportOrder(seaport, listing.orderData, address);

      setBuyState({ status: "pending", hash: txHash });

      // Step 3: Mark as fulfilled in our DB
      try {
        await fetch("/api/marketplace/fulfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: listing.orderId,
            txHash,
          }),
        });
      } catch {
        // Non-critical: listing will still be fulfilled on-chain
        console.warn("Failed to update listing status in DB");
      }

      setBuyState({ status: "success", hash: txHash });
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.includes("user rejected")
            ? "Transaction rejected by user."
            : err.message.length > 200
              ? err.message.slice(0, 200) + "..."
              : err.message
          : "An unexpected error occurred.";

      setBuyState({ status: "error", message });
    }
  }, [
    address,
    connectorClient,
    needsChainSwitch,
    switchChainAsync,
    listing,
    onSuccess,
  ]);

  // ─── Render ──────────────────────────────────────────────────────

  const isProcessing =
    buyState.status === "confirming" ||
    buyState.status === "pending" ||
    buyState.status === "switching-chain";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-[#333] bg-[#111] shadow-2xl">
        {/* Close button */}
        {!isProcessing && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1 text-[#555] transition-colors hover:text-white"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

        <div className="p-6">
          {/* Header */}
          <h2 className="mb-4 text-xl font-bold text-white">Confirm Purchase</h2>

          {/* NFT Info */}
          <div className="mb-4 flex items-start gap-4 rounded-xl bg-[#0a0a0a] p-4">
            {/* Placeholder image */}
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a1a1a] text-4xl">
              <span role="img" aria-label="pizza">&#127829;</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#7DD3E8]">
                {collectionInfo?.name || listing.collection}
              </p>
              <h3 className="truncate text-lg font-bold text-white">
                #{listing.tokenId}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                {/* Chain badge */}
                <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {CHAIN_LABELS[listing.chainId] || `Chain ${listing.chainId}`}
                </span>
                {/* Rarity badge */}
                {highestRarity && <RarityBadge rarity={highestRarity} />}
                {/* ERC1155 quantity */}
                {isERC1155 && (
                  <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#7DD3E8]">
                    Qty: 1
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Toppings */}
          {toppingDetails.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
                Toppings
              </p>
              <div className="flex flex-wrap gap-1">
                {toppingDetails.slice(0, 6).map((t) => (
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
                {toppingDetails.length > 6 && (
                  <span className="inline-flex items-center rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#555]">
                    +{toppingDetails.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="mb-4 rounded-xl bg-[#0a0a0a] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
              Price Breakdown
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#7DD3E8]">Item price</span>
                <span className="text-white">
                  {formatEthPrecise(priceBreakdown.itemPrice)} {listing.currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#7DD3E8]">
                  Marketplace fee ({bpsToPercent(MARKETPLACE_FEE_BPS)})
                </span>
                <span className="text-white">
                  {formatEthPrecise(priceBreakdown.marketplaceFee)} {listing.currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#7DD3E8]">
                  Creator royalty ({bpsToPercent(CREATOR_ROYALTY_BPS)})
                </span>
                <span className="text-white">
                  {formatEthPrecise(priceBreakdown.creatorRoyalty)} {listing.currency}
                </span>
              </div>
              <div className="mt-2 border-t border-[#333] pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-lg font-bold text-[#FFE135]">
                    {formatEthPrecise(priceBreakdown.total)} {listing.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Seller info */}
          <p className="mb-4 text-center text-xs text-[#555]">
            Seller: {truncateAddress(listing.seller)}
          </p>

          {/* Chain switch warning */}
          {needsChainSwitch && buyState.status === "idle" && (
            <div className="mb-4 rounded-lg border border-[#FFE135]/30 bg-[#FFE135]/10 px-4 py-3">
              <p className="text-xs text-[#FFE135]">
                This NFT is on {CHAIN_LABELS[listing.chainId] || `Chain ${listing.chainId}`}.
                You will be asked to switch networks.
              </p>
            </div>
          )}

          {/* Transaction Status */}
          {buyState.status === "switching-chain" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">
                  Switching to {CHAIN_LABELS[listing.chainId] || "the correct chain"}...
                </p>
              </div>
            </div>
          )}

          {buyState.status === "confirming" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">Confirm in wallet...</p>
              </div>
            </div>
          )}

          {buyState.status === "pending" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7DD3E8] border-t-transparent" />
                <p className="text-sm text-[#7DD3E8]">
                  Transaction pending...{" "}
                  <a
                    href={getExplorerTxUrl(buyState.hash, listing.chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white"
                  >
                    View on {getExplorerName(listing.chainId)}
                  </a>
                </p>
              </div>
            </div>
          )}

          {buyState.status === "success" && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-green-400">
                Purchase successful!
              </p>
              <p className="mt-1 text-xs text-green-400/80">
                Your NFT has been transferred to your wallet.{" "}
                <a
                  href={getExplorerTxUrl(buyState.hash, listing.chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  View on {getExplorerName(listing.chainId)}
                </a>
              </p>
            </div>
          )}

          {buyState.status === "error" && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{buyState.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {buyState.status === "success" ? (
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1 rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#555] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuy}
                  disabled={isProcessing || !address}
                  className="flex-1 rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Processing...
                    </span>
                  ) : (
                    "Confirm Purchase"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
