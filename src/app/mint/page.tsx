"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  PIZZA_BOX_CONTRACT,
  RARE_PIZZAS_CONTRACT,
  BOX_ABI,
  PIZZA_ABI,
  RECIPES,
} from "@/lib/contracts";
import TxStatus, { type TxState } from "@/components/TxStatus";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("User rejected")) return "Transaction rejected";
    if (msg.includes("insufficient funds")) return "Insufficient ETH balance";
    // Trim long RPC error messages
    const short = msg.split("\n")[0];
    return short.length > 120 ? short.slice(0, 120) + "..." : short;
  }
  return "Transaction failed";
}

// ─── Buy a Pizza Box ────────────────────────────────────────────────

function BuyBoxSection() {
  const { isConnected } = useAccount();
  const [quantity, setQuantity] = useState(1);
  const [txState, setTxState] = useState<TxState>({ status: "idle" });

  const { data: totalSupply } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "totalSupply",
  });

  const { data: maxSupply } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "maxSupply",
  });

  const { data: price } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "getPrice",
  });

  const { data: purchaseLimit } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "multiPurchaseLimit",
  });

  const maxQty = purchaseLimit ? Number(purchaseLimit) : 10;
  const unitPrice = price ?? parseEther("0.08");
  const totalCost = unitPrice * BigInt(quantity);

  const { writeContract } = useWriteContract({
    mutation: {
      onMutate() {
        setTxState({ status: "confirming" });
      },
      onSuccess(hash) {
        setTxState({ status: "pending", hash });
      },
      onError(error) {
        setTxState({ status: "error", message: extractErrorMessage(error) });
      },
    },
  });

  const pendingHash = txState.status === "pending" ? txState.hash : undefined;
  const { isSuccess: buyReceiptSuccess } = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: !!pendingHash },
  });

  useEffect(() => {
    if (buyReceiptSuccess && txState.status === "pending") {
      setTxState({ status: "success", hash: txState.hash });
    }
  }, [buyReceiptSuccess, txState]);

  const handleBuy = useCallback(() => {
    writeContract({
      address: PIZZA_BOX_CONTRACT,
      abi: BOX_ABI,
      functionName: "multiPurchase",
      args: [BigInt(quantity)],
      value: totalCost,
    });
  }, [writeContract, quantity, totalCost]);

  return (
    <section className="rounded-2xl border border-[#FFE135]/20 bg-[#111] p-6">
      <h2 className="mb-4 text-2xl font-bold text-[#FFE135]">Buy a Pizza Box</h2>

      <div className="mb-4 flex items-center gap-4 text-sm text-[#7DD3E8]">
        <span>
          Supply: {totalSupply !== undefined ? totalSupply.toString() : "..."} /{" "}
          {maxSupply !== undefined ? maxSupply.toString() : "..."}
        </span>
        <span>Price: {formatEther(unitPrice)} ETH each</span>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-white/60">Connect your wallet to buy a box</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-white/80">Quantity</label>
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              -
            </button>
            <span className="min-w-[2rem] text-center text-lg font-bold text-white">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              +
            </button>
            <span className="text-sm text-white/40">max {maxQty}</span>
          </div>

          <div className="mb-4 text-sm text-white/80">
            Total: <span className="font-bold text-[#FFE135]">{formatEther(totalCost)} ETH</span>
          </div>

          <button
            onClick={handleBuy}
            disabled={txState.status === "confirming" || txState.status === "pending"}
            className="rounded-lg bg-[#FFE135] px-6 py-2 font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {txState.status === "confirming"
              ? "Confirming..."
              : txState.status === "pending"
                ? "Pending..."
                : `Buy ${quantity} Box${quantity > 1 ? "es" : ""}`}
          </button>

          <TxStatus state={txState} />
        </>
      )}
    </section>
  );
}

// ─── Redeem a Box ───────────────────────────────────────────────────

function RedeemBoxSection() {
  const { address, isConnected } = useAccount();
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState(0);
  const [txState, setTxState] = useState<TxState>({ status: "idle" });

  // Get user's box balance
  const { data: boxBalance } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const totalBoxes = boxBalance ? Number(boxBalance) : 0;

  // Get all box token IDs
  const tokenIndexContracts = useMemo(() => {
    if (!address || !totalBoxes) return [];
    return Array.from({ length: totalBoxes }, (_, i) => ({
      address: PIZZA_BOX_CONTRACT,
      abi: BOX_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, totalBoxes]);

  const { data: tokenIdResults } = useReadContracts({
    contracts: tokenIndexContracts,
    query: { enabled: tokenIndexContracts.length > 0 },
  });

  const boxTokenIds = useMemo(() => {
    if (!tokenIdResults) return [];
    return tokenIdResults
      .filter((r) => r.status === "success" && r.result !== undefined)
      .map((r) => Number(r.result as bigint));
  }, [tokenIdResults]);

  // Check which boxes are redeemed
  const isRedeemedContracts = useMemo(() => {
    return boxTokenIds.map((tokenId) => ({
      address: RARE_PIZZAS_CONTRACT,
      abi: PIZZA_ABI,
      functionName: "isRedeemed" as const,
      args: [BigInt(tokenId)] as const,
    }));
  }, [boxTokenIds]);

  const { data: redeemedResults } = useReadContracts({
    contracts: isRedeemedContracts,
    query: { enabled: isRedeemedContracts.length > 0 },
  });

  const unredeemedBoxes = useMemo(() => {
    if (!redeemedResults) return boxTokenIds;
    return boxTokenIds.filter((_, i) => {
      const result = redeemedResults[i];
      return result?.status === "success" && result.result === false;
    });
  }, [boxTokenIds, redeemedResults]);

  const { writeContract } = useWriteContract({
    mutation: {
      onMutate() {
        setTxState({ status: "confirming" });
      },
      onSuccess(hash) {
        setTxState({ status: "pending", hash });
      },
      onError(error) {
        setTxState({ status: "error", message: extractErrorMessage(error) });
      },
    },
  });

  const redeemPendingHash = txState.status === "pending" ? txState.hash : undefined;
  const { isSuccess: redeemReceiptSuccess } = useWaitForTransactionReceipt({
    hash: redeemPendingHash,
    query: { enabled: !!redeemPendingHash },
  });

  useEffect(() => {
    if (redeemReceiptSuccess && txState.status === "pending") {
      setTxState({ status: "success", hash: txState.hash });
    }
  }, [redeemReceiptSuccess, txState]);

  const handleRedeem = useCallback(() => {
    if (selectedBox === null) return;
    writeContract({
      address: RARE_PIZZAS_CONTRACT,
      abi: PIZZA_ABI,
      functionName: "redeemRarePizzasBox",
      args: [BigInt(selectedBox), BigInt(selectedRecipe)],
    });
  }, [writeContract, selectedBox, selectedRecipe]);

  return (
    <section className="rounded-2xl border border-[#FFE135]/20 bg-[#111] p-6">
      <h2 className="mb-4 text-2xl font-bold text-[#FFE135]">Redeem a Box</h2>

      {!isConnected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-white/60">Connect your wallet to redeem boxes</p>
          <ConnectButton />
        </div>
      ) : unredeemedBoxes.length === 0 ? (
        <p className="text-sm text-white/60">
          {totalBoxes === 0
            ? "You don't own any Pizza Boxes. Buy one above!"
            : "All your boxes have been redeemed."}
        </p>
      ) : (
        <>
          <div className="mb-4">
            <label className="mb-2 block text-sm text-white/80">Select a Box</label>
            <div className="flex flex-wrap gap-2">
              {unredeemedBoxes.map((tokenId) => (
                <button
                  key={tokenId}
                  onClick={() => setSelectedBox(tokenId)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedBox === tokenId
                      ? "border-[#FFE135] bg-[#FFE135]/20 text-[#FFE135]"
                      : "border-white/10 bg-white/5 text-white/80 hover:border-white/30"
                  }`}
                >
                  Box #{tokenId}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm text-white/80">Choose a Recipe</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {RECIPES.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedRecipe === recipe.id
                      ? "border-[#FFE135] bg-[#FFE135]/20 text-[#FFE135]"
                      : "border-white/10 bg-white/5 text-white/80 hover:border-white/30"
                  }`}
                >
                  {recipe.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleRedeem}
            disabled={
              selectedBox === null ||
              txState.status === "confirming" ||
              txState.status === "pending"
            }
            className="rounded-lg bg-[#FFE135] px-6 py-2 font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {txState.status === "confirming"
              ? "Confirming..."
              : txState.status === "pending"
                ? "Pending..."
                : "Redeem Box"}
          </button>

          <TxStatus state={txState} />
        </>
      )}
    </section>
  );
}

// ─── Mint Page ──────────────────────────────────────────────────────

export default function MintPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">Mint</h1>
        <p className="text-[#7DD3E8]">Buy Pizza Boxes and redeem them for Rare Pizzas</p>
      </div>

      <div className="flex flex-col gap-8">
        <BuyBoxSection />
        <RedeemBoxSection />
      </div>
    </div>
  );
}
