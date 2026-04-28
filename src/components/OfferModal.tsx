"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useConnectorClient } from "wagmi";
import { parseEther, formatEther } from "ethers";
import RarityBadge from "@/components/RarityBadge";
import { getAllToppings } from "@/lib/toppings";
import { getImageUrl } from "@/lib/constants";
import { COLLECTIONS, CHAIN_LABELS } from "@/lib/collections";
import {
  MARKETPLACE_FEE_BPS,
  CREATOR_ROYALTY_BPS,
  FEE_RECIPIENT_ENS,
  calculateMarketplaceFee,
  calculateCreatorRoyalty,
  bpsToPercent,
} from "@/lib/marketplace-config";
import {
  createSeaportClient,
  createSeaportOffer,
  getExplorerTxUrl,
  getExplorerName,
  WETH_ADDRESSES,
} from "@/lib/seaport";
import type { Rarity } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────

interface ListingTopping {
  toppingSku: number;
  rarity: string;
}

interface OfferTarget {
  collection: string;
  tokenContract: string;
  chainId: number;
  tokenId: string;
  toppings?: ListingTopping[];
}

type OfferState =
  | { status: "idle" }
  | { status: "switching-chain" }
  | { status: "signing" }
  | { status: "submitting" }
  | { status: "success"; offerId: string }
  | { status: "error"; message: string };

interface OfferModalProps {
  target: OfferTarget;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Expiration Options ─────────────────────────────────────────────

const EXPIRATION_OPTIONS = [
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Hardcoded fee recipient for now — in production you'd resolve ENS
const FEE_RECIPIENT = "0x7F1D2C5a2a1d0E6E4B2E3F1c6b7A8d9E0F1C2D3" as const;

// ─── Component ───────────────────────────────────────────────────────

export default function OfferModal({ target, onClose, onSuccess }: OfferModalProps) {
  const { address, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();

  const [offerState, setOfferState] = useState<OfferState>({ status: "idle" });
  const [offerAmount, setOfferAmount] = useState("");
  const [expirationIdx, setExpirationIdx] = useState(2); // Default: 7 days

  const allToppings = getAllToppings();
  const collectionInfo = COLLECTIONS.find((c) => c.slug === target.collection);
  const isERC1155 = collectionInfo?.standard === "ERC1155";
  const needsChainSwitch = connectedChainId !== target.chainId;
  const wethAddress = WETH_ADDRESSES[target.chainId];

  // Parse offer amount
  const parsedAmount = useMemo(() => {
    try {
      if (!offerAmount || isNaN(Number(offerAmount)) || Number(offerAmount) <= 0) return null;
      return parseEther(offerAmount);
    } catch {
      return null;
    }
  }, [offerAmount]);

  // Fee breakdown (fees come out of the offer amount — the seller receives less)
  const feeBreakdown = useMemo(() => {
    if (!parsedAmount) return null;
    const marketplaceFee = calculateMarketplaceFee(parsedAmount);
    const creatorRoyalty = calculateCreatorRoyalty(parsedAmount);
    const sellerReceives = parsedAmount - marketplaceFee - creatorRoyalty;
    return { marketplaceFee, creatorRoyalty, sellerReceives, total: parsedAmount };
  }, [parsedAmount]);

  // Topping details
  const toppingDetails = useMemo(() => {
    if (!target.toppings) return [];
    return target.toppings
      .map((lt) => allToppings.find((t) => t.sku === lt.toppingSku))
      .filter(Boolean)
      .slice(0, 6);
  }, [target.toppings, allToppings]);

  const highestRarity = useMemo(() => {
    if (!target.toppings) return null;
    const order = ["grail", "epic", "superrare", "rare", "uncommon", "common"];
    for (const r of order) {
      if (target.toppings.some((t) => t.rarity === r)) return r as Rarity;
    }
    return null;
  }, [target.toppings]);

  // Close on escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && offerState.status !== "signing" && offerState.status !== "submitting") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, offerState.status]);

  // ─── Make Offer handler ─────────────────────────────────────────────

  const handleMakeOffer = useCallback(async () => {
    if (!address || !connectorClient || !parsedAmount || !feeBreakdown) {
      setOfferState({ status: "error", message: "Please connect your wallet and enter a valid amount." });
      return;
    }

    try {
      // Step 1: Switch chain if needed
      if (needsChainSwitch) {
        setOfferState({ status: "switching-chain" });
        try {
          await switchChainAsync({ chainId: target.chainId });
        } catch {
          setOfferState({
            status: "error",
            message: `Please switch to ${CHAIN_LABELS[target.chainId] || "the correct chain"} to make this offer.`,
          });
          return;
        }
      }

      // Step 2: Sign the offer order
      setOfferState({ status: "signing" });

      const provider = connectorClient.transport;
      const seaport = await createSeaportClient(provider, target.chainId);

      const expirationTimestamp = Math.floor(Date.now() / 1000) + EXPIRATION_OPTIONS[expirationIdx].seconds;

      const order = await createSeaportOffer(seaport, {
        tokenContract: target.tokenContract,
        tokenId: target.tokenId,
        tokenStandard: isERC1155 ? "ERC1155" : "ERC721",
        chainId: target.chainId,
        offerAmountWei: parsedAmount.toString(),
        marketplaceFeeWei: feeBreakdown.marketplaceFee.toString(),
        creatorRoyaltyWei: feeBreakdown.creatorRoyalty.toString(),
        feeRecipient: FEE_RECIPIENT,
        expirationTimestamp,
        offererAddress: address,
      });

      // Step 3: Submit to our API
      setOfferState({ status: "submitting" });

      // Generate a deterministic order ID from the signature
      const orderId = order.signature
        ? `0x${order.signature.slice(2, 66)}`
        : `offer-${address}-${target.tokenId}-${Date.now()}`;

      const res = await fetch("/api/marketplace/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: orderId,
          orderData: order,
          collection: target.collection,
          tokenContract: target.tokenContract,
          chainId: target.chainId,
          tokenId: target.tokenId,
          offerer: address,
          amount: parsedAmount.toString(),
          currency: "WETH",
          expiry: new Date(expirationTimestamp * 1000).toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to store offer");
      }

      setOfferState({ status: "success", offerId: orderId });
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.includes("user rejected")
            ? "Offer signing rejected by user."
            : err.message.length > 200
              ? err.message.slice(0, 200) + "..."
              : err.message
          : "An unexpected error occurred.";
      setOfferState({ status: "error", message });
    }
  }, [
    address,
    connectorClient,
    parsedAmount,
    feeBreakdown,
    needsChainSwitch,
    switchChainAsync,
    target,
    expirationIdx,
    isERC1155,
    onSuccess,
  ]);

  // ─── Render ──────────────────────────────────────────────────────

  const isProcessing =
    offerState.status === "signing" ||
    offerState.status === "submitting" ||
    offerState.status === "switching-chain";

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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        <div className="p-6">
          {/* Header */}
          <h2 className="mb-4 text-xl font-bold text-white">Make an Offer</h2>

          {/* NFT Info */}
          <div className="mb-4 flex items-start gap-4 rounded-xl bg-[#0a0a0a] p-4">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a1a1a] text-4xl">
              <span role="img" aria-label="pizza">&#127829;</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#7DD3E8]">
                {collectionInfo?.name || target.collection}
              </p>
              <h3 className="truncate text-lg font-bold text-white">
                #{target.tokenId}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {CHAIN_LABELS[target.chainId] || `Chain ${target.chainId}`}
                </span>
                {highestRarity && <RarityBadge rarity={highestRarity} />}
              </div>
            </div>
          </div>

          {/* Toppings */}
          {toppingDetails.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">Toppings</p>
              <div className="flex flex-wrap gap-1">
                {toppingDetails.map((t) => (
                  <span key={t!.sku} className="inline-flex items-center gap-1 rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#7DD3E8]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImageUrl(t!.image)} alt={t!.name} className="h-3 w-3 rounded-full" />
                    {t!.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Offer Amount Input */}
          {offerState.status !== "success" && (
            <>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#555]">
                  Offer Amount (WETH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.00"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-lg font-semibold text-white outline-none placeholder:text-[#555] focus:border-[#FFE135] disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#7DD3E8]">
                    WETH
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-[#555]">
                  Offers use WETH (Wrapped ETH). You need WETH balance to make an offer.
                </p>
              </div>

              {/* Expiration */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#555]">
                  Expiration
                </label>
                <div className="flex gap-2">
                  {EXPIRATION_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.seconds}
                      onClick={() => setExpirationIdx(idx)}
                      disabled={isProcessing}
                      className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                        expirationIdx === idx
                          ? "bg-[#FFE135] text-black"
                          : "border border-[#333] bg-[#0a0a0a] text-[#7DD3E8] hover:border-[#FFE135]/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee Breakdown */}
              {feeBreakdown && (
                <div className="mb-4 rounded-xl bg-[#0a0a0a] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
                    Fee Breakdown
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#7DD3E8]">Your offer</span>
                      <span className="text-white">{offerAmount} WETH</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#7DD3E8]">
                        Marketplace fee ({bpsToPercent(MARKETPLACE_FEE_BPS)})
                      </span>
                      <span className="text-white">
                        -{formatEther(feeBreakdown.marketplaceFee)} WETH
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#7DD3E8]">
                        Creator royalty ({bpsToPercent(CREATOR_ROYALTY_BPS)})
                      </span>
                      <span className="text-white">
                        -{formatEther(feeBreakdown.creatorRoyalty)} WETH
                      </span>
                    </div>
                    <div className="mt-2 border-t border-[#333] pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">Seller receives</span>
                        <span className="text-lg font-bold text-[#FFE135]">
                          {formatEther(feeBreakdown.sellerReceives)} WETH
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Chain switch warning */}
          {needsChainSwitch && offerState.status === "idle" && (
            <div className="mb-4 rounded-lg border border-[#FFE135]/30 bg-[#FFE135]/10 px-4 py-3">
              <p className="text-xs text-[#FFE135]">
                This NFT is on {CHAIN_LABELS[target.chainId] || `Chain ${target.chainId}`}.
                You will be asked to switch networks.
              </p>
            </div>
          )}

          {/* Status Messages */}
          {offerState.status === "switching-chain" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">Switching network...</p>
              </div>
            </div>
          )}

          {offerState.status === "signing" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">Sign offer in wallet...</p>
              </div>
            </div>
          )}

          {offerState.status === "submitting" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7DD3E8] border-t-transparent" />
                <p className="text-sm text-[#7DD3E8]">Submitting offer...</p>
              </div>
            </div>
          )}

          {offerState.status === "success" && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-green-400">Offer submitted!</p>
              <p className="mt-1 text-xs text-green-400/80">
                Your offer of {offerAmount} WETH has been submitted. The seller can accept it at any time before expiration.
              </p>
            </div>
          )}

          {offerState.status === "error" && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{offerState.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {offerState.status === "success" ? (
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
                  onClick={handleMakeOffer}
                  disabled={isProcessing || !address || !parsedAmount}
                  className="flex-1 rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Processing...
                    </span>
                  ) : (
                    "Submit Offer"
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
