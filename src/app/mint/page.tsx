"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
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

const BOX_GIF =
  "https://cdn.prod.website-files.com/60651d01d383e4f482012c1d/62766366d0b6df9beb6fa1d6_giphy.gif";
const PIZZA_GIF =
  "https://cdn.prod.website-files.com/60651d01d383e4f482012c1d/627663afbf9f574d9d507498_giphy-2.gif";

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("User rejected")) return "Transaction rejected";
    if (msg.includes("insufficient funds")) return "Insufficient ETH balance";
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

  const { data: totalNewPurchases } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "totalNewPurchases",
  });

  const { data: maxNewPurchases } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "maxNewPurchases",
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

  const available =
    totalNewPurchases !== undefined && maxNewPurchases !== undefined
      ? (maxNewPurchases - totalNewPurchases).toLocaleString()
      : "--";

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

  const quantityOptions = Array.from({ length: maxQty }, (_, i) => i + 1);

  return (
    <section className="flex flex-col items-center rounded-3xl bg-[#0d1117]/80 p-8 text-center backdrop-blur-sm">
      <h2 className="mb-6 font-[family-name:var(--font-naiche)] text-3xl italic text-white">
        Buy a Pizza Box!<span className="text-lg">*</span>
      </h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BOX_GIF}
        alt="Pizza Box"
        className="mb-6 h-48 w-auto rounded-lg"
      />

      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#FFE135]">
        Boxes Available
      </p>
      <p className="mb-2 text-xl font-bold text-white">
        {available} / {maxNewPurchases?.toLocaleString() ?? "10,000"}
      </p>
      <p className="mb-6 text-xs text-white/40">
        *Each Pizza Box NFT allows you to mint a Pizza.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-bold uppercase tracking-wider text-white">
          ETH Price
        </span>
        <span className="text-2xl font-bold text-white">
          {formatEther(unitPrice)}
        </span>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <ConnectButton />
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="rounded-lg border border-[#FFE135]/40 bg-[#0d1117] px-4 py-2 text-white focus:border-[#FFE135] focus:outline-none"
            >
              {quantityOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              onClick={handleBuy}
              disabled={
                txState.status === "confirming" || txState.status === "pending"
              }
              className="rounded-full border-2 border-[#FFE135] bg-transparent px-8 py-2 font-bold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
            >
              {txState.status === "confirming"
                ? "Confirming..."
                : txState.status === "pending"
                  ? "Pending..."
                  : "Mint"}
            </button>
          </div>

          {quantity > 1 && (
            <p className="mb-2 text-sm text-white/60">
              Total: {formatEther(totalCost)} ETH
            </p>
          )}

          <TxStatus state={txState} />
        </>
      )}

      <div className="mt-6 text-xs text-white/40">
        <p>Contract Address:</p>
        <a
          href={`https://etherscan.io/address/${PIZZA_BOX_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 underline hover:text-white"
        >
          {PIZZA_BOX_CONTRACT}
        </a>
      </div>
    </section>
  );
}

// ─── Order Pizza (Redeem) ───────────────────────────────────────────

function OrderPizzaSection() {
  const { address, isConnected } = useAccount();
  const [selectedBox, setSelectedBox] = useState<string>("");
  const [selectedRecipe, setSelectedRecipe] = useState(0);
  const [txState, setTxState] = useState<TxState>({ status: "idle" });

  const { data: pizzaTotalSupply } = useReadContract({
    address: RARE_PIZZAS_CONTRACT,
    abi: PIZZA_ABI,
    functionName: "totalSupply",
  });

  const { data: boxBalance } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const totalBoxes = boxBalance ? Number(boxBalance) : 0;

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

  const redeemPendingHash =
    txState.status === "pending" ? txState.hash : undefined;
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
    if (!selectedBox) return;
    writeContract({
      address: RARE_PIZZAS_CONTRACT,
      abi: PIZZA_ABI,
      functionName: "redeemRarePizzasBox",
      args: [BigInt(selectedBox), BigInt(selectedRecipe)],
    });
  }, [writeContract, selectedBox, selectedRecipe]);

  return (
    <section className="flex flex-col items-center rounded-3xl bg-[#0d1117]/80 p-8 text-center backdrop-blur-sm">
      <h2 className="mb-6 font-[family-name:var(--font-naiche)] text-3xl italic text-white">
        Order Pizza!
      </h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PIZZA_GIF}
        alt="Rare Pizza"
        className="mb-6 h-48 w-auto rounded-lg"
      />

      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#FFE135]">
        Ready to Order?
      </p>
      <p className="mb-2 text-xl font-bold text-white">
        {pizzaTotalSupply !== undefined ? pizzaTotalSupply.toString() : "-"}{" "}
        minted
      </p>
      <p className="mb-6 text-xs text-white/40">
        Baked pies take 30-60 minutes to render.
      </p>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <ConnectButton />
        </div>
      ) : unredeemedBoxes.length === 0 ? (
        <p className="text-sm text-white/60">
          {totalBoxes === 0
            ? "You don't own any Pizza Boxes. Buy one first!"
            : "All your boxes have been redeemed."}
        </p>
      ) : (
        <>
          <div className="mb-4 w-full max-w-xs text-left">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider text-white">
              1. Select Your Box
            </p>
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-[#0d1117] px-4 py-2 text-white focus:border-[#FFE135] focus:outline-none"
            >
              <option value="">Select one...</option>
              {unredeemedBoxes.map((tokenId) => (
                <option key={tokenId} value={tokenId}>
                  Box #{tokenId}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 w-full max-w-xs text-left">
            <p className="mb-2 text-sm font-bold uppercase tracking-wider text-white">
              2. Select Your Recipe
            </p>
            <select
              value={selectedRecipe}
              onChange={(e) => setSelectedRecipe(Number(e.target.value))}
              className="w-full rounded-lg border border-white/20 bg-[#0d1117] px-4 py-2 text-white focus:border-[#FFE135] focus:outline-none"
            >
              {RECIPES.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRedeem}
            disabled={
              !selectedBox ||
              txState.status === "confirming" ||
              txState.status === "pending"
            }
            className="rounded-full border-2 border-[#FFE135] bg-transparent px-10 py-2 font-bold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
          >
            {txState.status === "confirming"
              ? "Confirming..."
              : txState.status === "pending"
                ? "Pending..."
                : "Bake"}
          </button>

          <TxStatus state={txState} />
        </>
      )}

      <div className="mt-6 text-xs text-white/40">
        <p>Contract Address:</p>
        <a
          href={`https://etherscan.io/address/${RARE_PIZZAS_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 underline hover:text-white"
        >
          {RARE_PIZZAS_CONTRACT}
        </a>
      </div>
    </section>
  );
}

// ─── Check Redeemed ─────────────────────────────────────────────────

function CheckRedeemedSection() {
  const [tokenId, setTokenId] = useState("");
  const [checking, setChecking] = useState(false);

  const { data: isRedeemed, refetch } = useReadContract({
    address: RARE_PIZZAS_CONTRACT,
    abi: PIZZA_ABI,
    functionName: "isRedeemed",
    args: [BigInt(tokenId || "0")],
    query: { enabled: false },
  });

  const handleCheck = async () => {
    if (!tokenId) return;
    setChecking(true);
    await refetch();
    setChecking(false);
  };

  return (
    <section className="rounded-3xl border-t-2 border-[#FFE135] bg-[#0d1117]/80 p-8">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-8">
        <div className="flex-1">
          <h3 className="mb-1 font-[family-name:var(--font-naiche)] text-xl italic text-[#FFE135]">
            Has your pizza box been opened or redeemed?
          </h3>
          <p className="text-xs text-white/40">
            Check a Rare Pizza Box NFT using its Token ID.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Token ID"
            className="w-36 rounded-full border border-white/20 bg-[#0d1117] px-4 py-2 font-[family-name:var(--font-naiche)] text-lg italic text-white placeholder-white/30 focus:border-[#FFE135] focus:outline-none"
          />
          <button
            onClick={handleCheck}
            disabled={!tokenId || checking}
            className="rounded-full border-2 border-[#FFE135] px-6 py-2 font-bold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
          >
            {checking ? "..." : "Check"}
          </button>
        </div>
      </div>
      {isRedeemed !== undefined && tokenId && (
        <p className="mt-4 text-sm">
          {isRedeemed ? (
            <span className="text-[#FFE135]">
              Box #{tokenId} has been redeemed.
            </span>
          ) : (
            <span className="text-green-400">
              Box #{tokenId} has NOT been redeemed yet.
            </span>
          )}
        </p>
      )}
    </section>
  );
}

// ─── Mint Page ──────────────────────────────────────────────────────

export default function MintPage() {
  return (
    <div>
      <div className="grid gap-8 md:grid-cols-2">
        <BuyBoxSection />
        <OrderPizzaSection />
      </div>

      <div className="mt-8">
        <CheckRedeemedSection />
      </div>
    </div>
  );
}
