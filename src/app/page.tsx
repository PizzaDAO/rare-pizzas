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

const BOX_GIF = "/images/pizza-box.gif";
const PIZZA_GIF = "/images/pizza.gif";

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

// ─── Starfield background ─────────────────────────────────────────

function Starfield() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0e1a] via-[#0f1525] to-[#0b0e1a]" />
      {/* Stars via radial gradients */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 10% 15%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 25% 35%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 40% 10%, #7dd3fc 50%, transparent 100%),
            radial-gradient(1px 1px at 55% 60%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 70% 25%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 85% 45%, #7dd3fc 50%, transparent 100%),
            radial-gradient(1px 1px at 15% 70%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 30% 85%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 50% 40%, #7dd3fc 50%, transparent 100%),
            radial-gradient(1px 1px at 65% 80%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 80% 65%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 95% 90%, #7dd3fc 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 5% 50%, #fff 40%, transparent 100%),
            radial-gradient(1.5px 1.5px at 20% 20%, #f9a8d4 40%, transparent 100%),
            radial-gradient(1.5px 1.5px at 35% 75%, #7dd3fc 40%, transparent 100%),
            radial-gradient(1.5px 1.5px at 60% 5%, #fff 40%, transparent 100%),
            radial-gradient(1.5px 1.5px at 75% 55%, #f9a8d4 40%, transparent 100%),
            radial-gradient(1.5px 1.5px at 90% 30%, #7dd3fc 40%, transparent 100%),
            radial-gradient(1px 1px at 12% 92%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 45% 22%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 78% 8%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 92% 72%, #7dd3fc 50%, transparent 100%),
            radial-gradient(2px 2px at 3% 33%, #FFE135 30%, transparent 100%),
            radial-gradient(2px 2px at 48% 88%, #FFE135 30%, transparent 100%),
            radial-gradient(2px 2px at 97% 12%, #FFE135 30%, transparent 100%),
            radial-gradient(1px 1px at 8% 58%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 33% 48%, #fff 50%, transparent 100%),
            radial-gradient(1px 1px at 58% 32%, #7dd3fc 50%, transparent 100%),
            radial-gradient(1px 1px at 83% 78%, #f9a8d4 50%, transparent 100%),
            radial-gradient(1px 1px at 18% 4%, #fff 50%, transparent 100%)
          `,
        }}
      />
      {/* Subtle cross sparkles */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            radial-gradient(1px 6px at 22% 44%, #f9a8d4 40%, transparent 100%),
            radial-gradient(6px 1px at 22% 44%, #f9a8d4 40%, transparent 100%),
            radial-gradient(1px 6px at 67% 18%, #7dd3fc 40%, transparent 100%),
            radial-gradient(6px 1px at 67% 18%, #7dd3fc 40%, transparent 100%),
            radial-gradient(1px 6px at 88% 56%, #f9a8d4 40%, transparent 100%),
            radial-gradient(6px 1px at 88% 56%, #f9a8d4 40%, transparent 100%),
            radial-gradient(1px 6px at 42% 72%, #7dd3fc 40%, transparent 100%),
            radial-gradient(6px 1px at 42% 72%, #7dd3fc 40%, transparent 100%),
            radial-gradient(1px 5px at 7% 82%, #FFE135 40%, transparent 100%),
            radial-gradient(5px 1px at 7% 82%, #FFE135 40%, transparent 100%),
            radial-gradient(1px 5px at 55% 5%, #FFE135 40%, transparent 100%),
            radial-gradient(5px 1px at 55% 5%, #FFE135 40%, transparent 100%)
          `,
        }}
      />
    </div>
  );
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

  const available =
    totalNewPurchases !== undefined && maxNewPurchases !== undefined
      ? Number(maxNewPurchases - totalNewPurchases).toLocaleString()
      : "--";

  const maxDisplay = maxSupply
    ? Number(maxSupply).toLocaleString()
    : "10,000";

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
    <section className="flex flex-col items-center rounded-2xl border border-white/5 bg-[#111827]/90 px-6 py-8 text-center backdrop-blur-sm sm:px-10">
      <h2 className="mb-6 font-[family-name:var(--font-naiche)] text-4xl italic text-white">
        Buy a Pizza Box!<span className="ml-1 text-lg text-white/50">*</span>
      </h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BOX_GIF}
        alt="Pizza Box"
        className="mb-6 w-72 rounded-lg"
      />

      <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#FFE135]">
        Boxes Available
      </p>
      <p className="mb-1 text-2xl font-bold text-white">
        {available} / {maxDisplay}
      </p>
      <p className="mb-6 text-xs text-white/40">
        *Each Pizza Box NFT allows you to mint a Pizza.
      </p>

      <div className="mb-5 flex items-center gap-4">
        <span className="text-sm font-bold uppercase tracking-wider text-white">
          ETH Price
        </span>
        <span className="text-3xl font-bold text-white">
          {formatEther(unitPrice)}
        </span>
        <svg className="h-5 w-5 text-white/60" viewBox="0 0 256 417" fill="currentColor">
          <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6" />
          <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
          <path d="M127.961 312.187l-1.575 1.92V414.27l1.575 4.6L256 236.587z" opacity=".6" />
          <path d="M127.962 418.87v-106.68L0 236.585z" />
        </svg>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <ConnectButton />
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-4">
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="h-11 w-20 cursor-pointer rounded-lg border border-white/20 bg-[#1f2937] px-3 py-2 text-lg text-white focus:border-[#FFE135] focus:outline-none"
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
              className="h-11 min-w-[140px] rounded-full border-2 border-[#FFE135] bg-transparent px-8 font-bold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
            >
              {txState.status === "confirming"
                ? "Confirm..."
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

      <div className="mt-auto pt-6 text-xs text-white/40">
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
      .map((r) => Number(r.result as bigint))
      .sort((a, b) => a - b);
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
    <section className="flex flex-col items-center rounded-2xl border border-white/5 bg-[#111827]/90 px-6 py-8 text-center backdrop-blur-sm sm:px-10">
      <h2 className="mb-6 font-[family-name:var(--font-naiche)] text-4xl italic text-white">
        Order Pizza!
      </h2>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PIZZA_GIF}
        alt="Rare Pizza"
        className="mb-6 w-64 rounded-lg"
      />

      <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[#FFE135]">
        Ready to Order?
      </p>
      <p className="mb-1 text-2xl font-bold text-white">
        {pizzaTotalSupply !== undefined ? pizzaTotalSupply.toString() : "--"}{" "}
        minted
      </p>
      <p className="mb-6 text-xs text-white/40">
        Baked pies take 30-60 minutes to render!
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
              className="h-11 w-full cursor-pointer rounded-lg border border-white/20 bg-[#1f2937] px-4 py-2 text-white focus:border-[#FFE135] focus:outline-none"
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
              className="h-11 w-full cursor-pointer rounded-lg border border-white/20 bg-[#1f2937] px-4 py-2 text-white focus:border-[#FFE135] focus:outline-none"
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
            className="h-11 min-w-[160px] rounded-full border-2 border-[#FFE135] bg-transparent px-10 font-bold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
          >
            {txState.status === "confirming"
              ? "Confirm..."
              : txState.status === "pending"
                ? "Pending..."
                : "Bake"}
          </button>

          <TxStatus state={txState} />
        </>
      )}

      <div className="mt-auto pt-6 text-xs text-white/40">
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

  const handleCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tokenId) return;
    setChecking(true);
    await refetch();
    setChecking(false);
  };

  return (
    <section className="rounded-2xl border-t-2 border-[#FFE135] bg-[#111827]/90 px-6 py-8 backdrop-blur-sm sm:px-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
        <div className="flex-1">
          <h3 className="mb-2 font-[family-name:var(--font-naiche)] text-2xl italic text-[#FFE135]">
            Has your pizza box been opened or redeemed?
          </h3>
          <p className="text-sm text-white/50">
            Check a Rare Pizza Box NFT using its Token ID.
          </p>
        </div>
        <form onSubmit={handleCheck} className="flex items-center gap-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value.replace(/\D/g, ""))}
            placeholder="Token ID"
            className="h-14 w-44 rounded-lg border border-white/20 bg-[#1f2937] px-4 font-[family-name:var(--font-naiche)] text-2xl italic text-white placeholder-white/25 focus:border-[#FFE135] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!tokenId || checking}
            className="h-11 min-w-[100px] rounded-full border-2 border-[#FFE135] px-8 font-bold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
          >
            {checking ? "..." : "Check"}
          </button>
        </form>
      </div>
      {isRedeemed !== undefined && tokenId && (
        <p className="mt-4 text-sm">
          {isRedeemed ? (
            <span className="text-[#FFE135]">
              Box #{tokenId} has been redeemed.{" "}
              <a
                href={`https://opensea.io/assets/ethereum/${RARE_PIZZAS_CONTRACT}/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                View Pizza #{tokenId} on OpenSea
              </a>
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
    <div className="-mx-4 -mt-8">
      <Starfield />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {/* Hero */}
        <div className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/rarepizza-logo.png"
            alt="Rare Pizzas"
            className="mx-auto mb-6 h-20 w-auto sm:h-24"
          />
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80">
            10,000 generatively baked pizzas in a one-of-a-kind collaboration
            between 314 international artists. Each box can be opened to claim
            one randomly generated pizza.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/50">
            On May 22, 2010, Laszlo Hanyecz bought two pizzas for 10,000
            Bitcoin. Now, PizzaDAO throws a{" "}
            <a href="https://globalpizza.party" target="_blank" rel="noopener noreferrer" className="text-[#FFE135] underline hover:text-white">
              Global Pizza Party
            </a>{" "}
            every May 22 in his honor. Sales of Rare Pizzas support PizzaDAO.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <BuyBoxSection />
          <OrderPizzaSection />
        </div>
        <div className="mt-8">
          <CheckRedeemedSection />
        </div>
      </div>
    </div>
  );
}
