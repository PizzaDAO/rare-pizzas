"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount, useSwitchChain, useConnectorClient } from "wagmi";
import { COLLECTIONS, CHAIN_LABELS } from "@/lib/collections";
import {
  transferNft,
  resolveRecipient,
  getExplorerTxUrl,
  getExplorerName,
} from "@/lib/seaport";

// ─── Types ───────────────────────────────────────────────────────────

export interface SendTarget {
  collection: string; // slug from COLLECTIONS
  tokenContract: string;
  chainId: number;
  tokenId: string;
  standard: "ERC721" | "ERC1155";
  imageUrl?: string;
  name?: string;
  ownedQuantity?: number; // ERC1155 only
}

type SendState =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "switching-chain" }
  | { status: "sending" }
  | { status: "success"; txHash: string }
  | { status: "error"; message: string };

interface SendModalProps {
  target: SendTarget;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Component ───────────────────────────────────────────────────────

export default function SendModal({ target, onClose, onSuccess }: SendModalProps) {
  const { address, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();

  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [recipient, setRecipient] = useState("");
  const [resolvedTo, setResolvedTo] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const collectionInfo = COLLECTIONS.find((c) => c.slug === target.collection);
  const isERC1155 = target.standard === "ERC1155";
  const needsChainSwitch = connectedChainId !== target.chainId;
  const ownedQty = target.ownedQuantity ?? 1;
  const showQuantity = isERC1155 && ownedQty > 1;

  // Lightweight client-side validity hint (does not resolve ENS).
  const trimmedRecipient = recipient.trim();
  const looksValid = useMemo(() => {
    if (!trimmedRecipient) return false;
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmedRecipient)) return true;
    if (trimmedRecipient.toLowerCase().endsWith(".eth")) return true;
    return false;
  }, [trimmedRecipient]);

  const isProcessing =
    sendState.status === "resolving" ||
    sendState.status === "switching-chain" ||
    sendState.status === "sending";

  // Close on escape (not while a transaction is in flight)
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !isProcessing) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isProcessing]);

  // ─── Send handler ───────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!address || !connectorClient) {
      setSendState({ status: "error", message: "Please connect your wallet." });
      return;
    }
    if (!trimmedRecipient) {
      setSendState({ status: "error", message: "Enter a recipient 0x address or ENS name." });
      return;
    }

    try {
      // Step 1: Resolve / validate recipient
      setSendState({ status: "resolving" });
      const to = await resolveRecipient(trimmedRecipient);
      if (!to) {
        setSendState({
          status: "error",
          message: "Enter a valid 0x address or ENS name.",
        });
        return;
      }
      if (to.toLowerCase() === address.toLowerCase()) {
        setSendState({
          status: "error",
          message: "You can't send an NFT to your own wallet.",
        });
        return;
      }
      setResolvedTo(to);

      // Step 2: Switch chain if needed
      if (needsChainSwitch) {
        setSendState({ status: "switching-chain" });
        try {
          await switchChainAsync({ chainId: target.chainId });
        } catch {
          setSendState({
            status: "error",
            message: `Please switch to ${CHAIN_LABELS[target.chainId] || "the correct chain"} to send this NFT.`,
          });
          return;
        }
      }

      // Step 3: Transfer
      setSendState({ status: "sending" });
      const txHash = await transferNft(connectorClient.transport, {
        tokenContract: target.tokenContract,
        tokenId: target.tokenId,
        from: address,
        to,
        standard: target.standard,
        amount: isERC1155 ? quantity : 1,
      });

      setSendState({ status: "success", txHash });
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.includes("user rejected")
            ? "Transfer rejected by user."
            : err.message.length > 200
              ? err.message.slice(0, 200) + "..."
              : err.message
          : "An unexpected error occurred.";
      setSendState({ status: "error", message });
    }
  }, [
    address,
    connectorClient,
    trimmedRecipient,
    needsChainSwitch,
    switchChainAsync,
    target,
    isERC1155,
    quantity,
    onSuccess,
  ]);

  // ─── Render ──────────────────────────────────────────────────────

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
          <h2 className="mb-4 text-xl font-bold text-white">Send NFT</h2>

          {/* NFT Info */}
          <div className="mb-4 flex items-start gap-4 rounded-xl bg-[#0a0a0a] p-4">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1a1a1a] text-4xl">
              {target.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={target.imageUrl}
                  alt={target.name || `#${target.tokenId}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span role="img" aria-label="pizza">&#127829;</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#7DD3E8]">
                {collectionInfo?.name || target.collection}
              </p>
              <h3 className="truncate text-lg font-bold text-white">
                {target.name || `#${target.tokenId}`}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {CHAIN_LABELS[target.chainId] || `Chain ${target.chainId}`}
                </span>
                <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] font-semibold text-[#7DD3E8]">
                  #{target.tokenId}
                </span>
              </div>
            </div>
          </div>

          {sendState.status !== "success" && (
            <>
              {/* Recipient input */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#555]">
                  Recipient
                </label>
                <input
                  type="text"
                  placeholder="0x… or name.eth"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setResolvedTo(null);
                  }}
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm font-medium text-white outline-none placeholder:text-[#555] focus:border-[#FFE135] disabled:opacity-50"
                />
                {trimmedRecipient.length > 0 && (
                  <p className={`mt-1 text-[10px] ${looksValid ? "text-[#7DD3E8]" : "text-red-400"}`}>
                    {looksValid
                      ? trimmedRecipient.toLowerCase().endsWith(".eth")
                        ? "ENS name — will be resolved on Ethereum."
                        : "Looks like a valid address."
                      : "Enter a 0x address or an ENS name ending in .eth."}
                  </p>
                )}
              </div>

              {/* ERC1155 quantity */}
              {showQuantity && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#555]">
                    Quantity (you own {ownedQty})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={ownedQty}
                    step={1}
                    value={quantity}
                    onChange={(e) => {
                      const v = Math.floor(Number(e.target.value));
                      if (Number.isNaN(v)) return;
                      setQuantity(Math.min(Math.max(v, 1), ownedQty));
                    }}
                    disabled={isProcessing}
                    className="w-full rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#FFE135] disabled:opacity-50"
                  />
                </div>
              )}

              {/* Resolved destination preview — transfers are irreversible */}
              {resolvedTo && (
                <div className="mb-4 rounded-xl bg-[#0a0a0a] p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#555]">
                    Sending to
                  </p>
                  <p className="break-all font-mono text-sm text-white">{resolvedTo}</p>
                  <p className="mt-2 text-[10px] text-[#FFE135]">
                    Double-check this address — transfers are irreversible.
                  </p>
                </div>
              )}

              {/* Chain switch warning */}
              {needsChainSwitch && sendState.status === "idle" && (
                <div className="mb-4 rounded-lg border border-[#FFE135]/30 bg-[#FFE135]/10 px-4 py-3">
                  <p className="text-xs text-[#FFE135]">
                    This NFT is on {CHAIN_LABELS[target.chainId] || `Chain ${target.chainId}`}.
                    You will be asked to switch networks.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Status Messages */}
          {sendState.status === "resolving" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">Resolving recipient...</p>
              </div>
            </div>
          )}

          {sendState.status === "switching-chain" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">Switching network...</p>
              </div>
            </div>
          )}

          {sendState.status === "sending" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7DD3E8] border-t-transparent" />
                <p className="text-sm text-[#7DD3E8]">Confirm in wallet and wait for confirmation...</p>
              </div>
            </div>
          )}

          {sendState.status === "success" && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-green-400">NFT sent!</p>
              <p className="mt-1 text-xs text-green-400/80">
                {target.name || `#${target.tokenId}`} was transferred
                {resolvedTo ? ` to ${truncateAddress(resolvedTo)}` : ""}.
              </p>
              <a
                href={getExplorerTxUrl(sendState.txHash, target.chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#7DD3E8] underline hover:text-white"
              >
                View on {getExplorerName(target.chainId)}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}

          {sendState.status === "error" && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{sendState.message}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {sendState.status === "success" ? (
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
                  onClick={handleSend}
                  disabled={isProcessing || !address || !trimmedRecipient}
                  className="flex-1 rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Processing...
                    </span>
                  ) : (
                    "Send"
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
