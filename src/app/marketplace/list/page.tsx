"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount, useReadContract, useReadContracts, useSwitchChain } from "wagmi";
import { useConnectorClient } from "wagmi";
import { parseEther, formatEther } from "ethers";
import RarityBadge from "@/components/RarityBadge";
import { getAllToppings, matchTopping } from "@/lib/toppings";
import { getImageUrl, IPFS_GATEWAY, ERC721_ENUMERABLE_ABI } from "@/lib/constants";
import { COLLECTIONS, CHAIN_LABELS, CHAIN_CURRENCIES, type Collection } from "@/lib/collections";
import {
  MARKETPLACE_FEE_BPS,
  CREATOR_ROYALTY_BPS,
  calculateFeesFromPrice,
  bpsToPercent,
} from "@/lib/marketplace-config";
import {
  createSeaportClient,
  createSeaportListing,
  checkApproval,
  approveForSeaport,
} from "@/lib/seaport";
import { BOX_ABI } from "@/lib/contracts";
import type { Rarity, NFTAttribute, Topping } from "@/lib/types";

const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((mod) => mod.ConnectButton),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────────────

interface OwnedNFT {
  collection: Collection;
  tokenId: string;
  name?: string;
  image?: string;
  toppings: Array<{ sku: number; rarity: string; name: string }>;
  quantity?: number; // For ERC1155
}

type ListStep = "select" | "configure" | "sign";

type SignState =
  | { status: "idle" }
  | { status: "checking-approval" }
  | { status: "approving" }
  | { status: "switching-chain" }
  | { status: "signing" }
  | { status: "submitting" }
  | { status: "success"; orderId: string }
  | { status: "error"; message: string };

const EXPIRATION_OPTIONS = [
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
  { label: "30 days", seconds: 2592000 },
] as const;

// Hardcoded fee recipient for now — in production resolve from ENS
const FEE_RECIPIENT = "0x7F1D2C5a2a1d0E6E4B2E3F1c6b7A8d9E0F1C2D3";

const IPFS_GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  IPFS_GATEWAY,
];

// ─── Helpers ─────────────────────────────────────────────────────────

function extractIpfsHash(url: string): string | null {
  const match = url.match(/\/ipfs\/(.+)$/);
  return match ? match[1] : null;
}

function ipfsUrl(url: string): string {
  const hash = extractIpfsHash(url);
  return hash ? `${IPFS_GATEWAYS[0]}${hash}` : url;
}

// ─── NFT Enumeration Hook (ERC721) ─────────────────────────────────

function useOwnedTokenIds(
  contractAddress: `0x${string}`,
  abi: readonly object[],
  enabled: boolean,
  address?: `0x${string}`
) {
  const { data: balance } = useReadContract({
    address: contractAddress,
    abi: abi as typeof BOX_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address },
  });

  const total = balance ? Number(balance) : 0;

  const contracts = useMemo(() => {
    if (!address || !total) return [];
    return Array.from({ length: total }, (_, i) => ({
      address: contractAddress,
      abi: abi as typeof BOX_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, total, contractAddress, abi]);

  const { data: results } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  });

  const tokenIds = useMemo(() => {
    if (!results) return [];
    return results
      .filter((r) => r.status === "success" && r.result !== undefined)
      .map((r) => Number(r.result as bigint))
      .sort((a, b) => a - b);
  }, [results]);

  return { total, tokenIds, isLoading: total > 0 && tokenIds.length === 0 };
}

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
        Connect your wallet to see your PizzaDAO NFTs and create a listing.
      </p>
      <ConnectButton />
    </div>
  );
}

// ─── NFT Card (Step 1) ────────────────────────────────────────────

function NFTCard({
  nft,
  selected,
  onSelect,
}: {
  nft: OwnedNFT;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl border p-3 text-left transition-all ${
        selected
          ? "border-[#FFE135] bg-[#FFE135]/10"
          : "border-[#333]/50 bg-[#111] hover:border-[#FFE135]/50"
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-[#0a0a0a]">
        {nft.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ipfsUrl(nft.image)}
            alt={nft.name || `#${nft.tokenId}`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            <span role="img" aria-label="pizza">&#127829;</span>
          </div>
        )}
        {/* Collection badge */}
        <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          {CHAIN_LABELS[nft.collection.chainId]}
        </div>
        {nft.quantity && nft.quantity > 1 && (
          <div className="absolute right-2 top-2 rounded-full bg-[#FFE135] px-2 py-0.5 text-[10px] font-bold text-black">
            x{nft.quantity}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-[#7DD3E8]">{nft.collection.name}</p>
      <h3 className="truncate text-sm font-semibold text-white">
        {nft.name || `#${nft.tokenId}`}
      </h3>
      {nft.toppings.length > 0 && (
        <p className="mt-1 text-[10px] text-[#555]">
          {nft.toppings.length} topping{nft.toppings.length !== 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function ListPage() {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: connectorClient } = useConnectorClient();

  const [step, setStep] = useState<ListStep>("select");
  const [selectedNFT, setSelectedNFT] = useState<OwnedNFT | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [expirationIdx, setExpirationIdx] = useState(2); // 7 days
  const [quantity, setQuantity] = useState(1);
  const [signState, setSignState] = useState<SignState>({ status: "idle" });

  // Enumerate owned NFTs for ERC721 collections
  const boxTokens = useOwnedTokenIds(
    COLLECTIONS[0].contract as `0x${string}`,
    ERC721_ENUMERABLE_ABI,
    isConnected,
    address
  );

  const pizzaTokens = useOwnedTokenIds(
    COLLECTIONS[1].contract as `0x${string}`,
    ERC721_ENUMERABLE_ABI,
    isConnected,
    address
  );

  // Build NFT metadata for display — fetch IPFS metadata
  const [nftMeta, setNftMeta] = useState<Record<string, { name: string; image: string; attributes?: NFTAttribute[] }>>({});

  // Fetch metadata for each token
  useEffect(() => {
    if (!boxTokens.tokenIds.length && !pizzaTokens.tokenIds.length) return;

    let cancelled = false;

    async function fetchMetadata(collection: Collection, tokenId: number) {
      const key = `${collection.contract}-${tokenId}`;
      // Check cache
      try {
        const cached = sessionStorage.getItem(`nft-meta-${key}`);
        if (cached) return JSON.parse(cached);
      } catch {}

      // Try fetching tokenURI on-chain (we can use a simple RPC call)
      try {
        const rpcUrl = collection.chainId === 1
          ? "https://ethereum-rpc.publicnode.com"
          : "https://optimism-rpc.publicnode.com";

        // Encode tokenURI(uint256) call
        const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, "0");
        const data = `0xc87b56dd${tokenIdHex}`; // tokenURI selector

        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{ to: collection.contract, data }, "latest"],
            id: 1,
          }),
        });

        const json = await res.json();
        if (json.result && json.result !== "0x") {
          // Decode the ABI-encoded string
          const hex = json.result.slice(2);
          const offset = parseInt(hex.slice(0, 64), 16) * 2;
          const length = parseInt(hex.slice(offset, offset + 64), 16);
          const strHex = hex.slice(offset + 64, offset + 64 + length * 2);
          const uri = Buffer.from(strHex, "hex").toString("utf8");

          // Fetch the JSON metadata from IPFS
          const hash = extractIpfsHash(uri);
          if (hash) {
            for (const gateway of IPFS_GATEWAYS) {
              try {
                const metaRes = await fetch(`${gateway}${hash}`, {
                  signal: AbortSignal.timeout(10000),
                });
                if (!metaRes.ok) continue;
                const meta = await metaRes.json();
                const result = {
                  name: meta.name || "",
                  image: meta.image || "",
                  attributes: meta.attributes || [],
                };
                try {
                  sessionStorage.setItem(`nft-meta-${key}`, JSON.stringify(result));
                } catch {}
                return result;
              } catch {
                continue;
              }
            }
          }
        }
      } catch {}
      return null;
    }

    async function fetchAll() {
      const items: Array<{ collection: Collection; tokenId: number }> = [];

      for (const tokenId of boxTokens.tokenIds) {
        items.push({ collection: COLLECTIONS[0] as unknown as Collection, tokenId });
      }
      for (const tokenId of pizzaTokens.tokenIds) {
        items.push({ collection: COLLECTIONS[1] as unknown as Collection, tokenId });
      }

      // Fetch in parallel, 5 at a time
      const MAX_CONCURRENT = 5;
      const queue = [...items];
      const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, async () => {
        while (queue.length > 0 && !cancelled) {
          const item = queue.shift();
          if (!item) break;
          const meta = await fetchMetadata(item.collection, item.tokenId);
          if (meta && !cancelled) {
            const key = `${item.collection.contract}-${item.tokenId}`;
            setNftMeta((prev) => ({ ...prev, [key]: meta }));
          }
        }
      });
      await Promise.all(workers);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [boxTokens.tokenIds, pizzaTokens.tokenIds]);

  // Build owned NFTs list
  const allToppings = getAllToppings();
  const ownedNFTs = useMemo(() => {
    const nfts: OwnedNFT[] = [];

    for (const tokenId of boxTokens.tokenIds) {
      const key = `${COLLECTIONS[0].contract}-${tokenId}`;
      const meta = nftMeta[key];
      const toppings: OwnedNFT["toppings"] = [];

      if (meta?.attributes) {
        for (const attr of meta.attributes) {
          const matched = matchTopping(attr);
          if (matched) {
            toppings.push({ sku: matched.sku, rarity: matched.rarity, name: matched.name });
          }
        }
      }

      nfts.push({
        collection: COLLECTIONS[0] as unknown as Collection,
        tokenId: String(tokenId),
        name: meta?.name,
        image: meta?.image,
        toppings,
      });
    }

    for (const tokenId of pizzaTokens.tokenIds) {
      const key = `${COLLECTIONS[1].contract}-${tokenId}`;
      const meta = nftMeta[key];
      const toppings: OwnedNFT["toppings"] = [];

      if (meta?.attributes) {
        for (const attr of meta.attributes) {
          const matched = matchTopping(attr);
          if (matched) {
            toppings.push({ sku: matched.sku, rarity: matched.rarity, name: matched.name });
          }
        }
      }

      nfts.push({
        collection: COLLECTIONS[1] as unknown as Collection,
        tokenId: String(tokenId),
        name: meta?.name,
        image: meta?.image || `/pizzas/${tokenId}.webp`,
        toppings,
      });
    }

    return nfts;
  }, [boxTokens.tokenIds, pizzaTokens.tokenIds, nftMeta, allToppings]);

  const isLoadingNFTs = boxTokens.isLoading || pizzaTokens.isLoading;

  // Parse price
  const parsedPrice = useMemo(() => {
    try {
      if (!priceInput || isNaN(Number(priceInput)) || Number(priceInput) <= 0) return null;
      return parseEther(priceInput);
    } catch {
      return null;
    }
  }, [priceInput]);

  // Fee breakdown (fees are deducted from the listed price)
  const feeBreakdown = useMemo(() => {
    if (!parsedPrice) return null;
    return calculateFeesFromPrice(parsedPrice);
  }, [parsedPrice]);

  // Handle listing creation
  const handleCreateListing = useCallback(async () => {
    if (!address || !connectorClient || !selectedNFT || !parsedPrice || !feeBreakdown) {
      setSignState({ status: "error", message: "Missing required data. Please try again." });
      return;
    }

    try {
      const targetChainId = selectedNFT.collection.chainId;
      const needsSwitch = connectedChainId !== targetChainId;

      // Step 1: Switch chain if needed
      if (needsSwitch) {
        setSignState({ status: "switching-chain" });
        try {
          await switchChainAsync({ chainId: targetChainId });
        } catch {
          setSignState({
            status: "error",
            message: `Please switch to ${CHAIN_LABELS[targetChainId]} to create this listing.`,
          });
          return;
        }
      }

      // Step 2: Check approval
      setSignState({ status: "checking-approval" });
      const provider = connectorClient.transport;
      const isApproved = await checkApproval(
        provider,
        targetChainId,
        selectedNFT.collection.contract,
        address,
        selectedNFT.collection.standard
      );

      // Step 3: Approve if needed
      if (!isApproved) {
        setSignState({ status: "approving" });
        try {
          await approveForSeaport(provider, targetChainId, selectedNFT.collection.contract);
        } catch (err) {
          setSignState({
            status: "error",
            message: err instanceof Error && err.message.includes("user rejected")
              ? "Approval rejected by user."
              : "Failed to approve Seaport. Please try again.",
          });
          return;
        }
      }

      // Step 4: Sign the listing order
      setSignState({ status: "signing" });
      const seaport = await createSeaportClient(provider, targetChainId);

      const expirationTimestamp = Math.floor(Date.now() / 1000) + EXPIRATION_OPTIONS[expirationIdx].seconds;

      const order = await createSeaportListing(seaport, {
        tokenContract: selectedNFT.collection.contract,
        tokenId: selectedNFT.tokenId,
        tokenStandard: selectedNFT.collection.standard,
        priceWei: feeBreakdown.sellerReceives.toString(),
        marketplaceFeeWei: feeBreakdown.marketplaceFee.toString(),
        creatorRoyaltyWei: feeBreakdown.creatorRoyalty.toString(),
        feeRecipient: FEE_RECIPIENT,
        expirationTimestamp,
        sellerAddress: address,
        quantity: selectedNFT.collection.standard === "ERC1155" ? quantity : 1,
      });

      // Step 5: Submit to our API
      setSignState({ status: "submitting" });

      // Generate a deterministic order ID from the signature
      const orderId = order.signature
        ? `0x${order.signature.slice(2, 66)}`
        : `listing-${address}-${selectedNFT.tokenId}-${Date.now()}`;

      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderData: order,
          collection: selectedNFT.collection.slug,
          tokenContract: selectedNFT.collection.contract,
          chainId: targetChainId,
          tokenId: selectedNFT.tokenId,
          seller: address,
          price: parsedPrice.toString(),
          currency: CHAIN_CURRENCIES[targetChainId] || "ETH",
          expiry: new Date(expirationTimestamp * 1000).toISOString(),
          toppings: selectedNFT.toppings.map((t) => ({ sku: t.sku, rarity: t.rarity })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to store listing");
      }

      setSignState({ status: "success", orderId });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message.includes("user rejected")
            ? "Listing signing rejected by user."
            : err.message.length > 200
              ? err.message.slice(0, 200) + "..."
              : err.message
          : "An unexpected error occurred.";
      setSignState({ status: "error", message });
    }
  }, [
    address,
    connectorClient,
    connectedChainId,
    selectedNFT,
    parsedPrice,
    feeBreakdown,
    switchChainAsync,
    expirationIdx,
    quantity,
  ]);

  const isProcessing =
    signState.status === "checking-approval" ||
    signState.status === "approving" ||
    signState.status === "switching-chain" ||
    signState.status === "signing" ||
    signState.status === "submitting";

  // ─── Render ────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-4">
          <Link href="/marketplace" className="text-sm text-[#7DD3E8] transition-colors hover:text-white">
            &larr; Back to Marketplace
          </Link>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-white">List an NFT</h1>
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

      <h1 className="mb-6 text-3xl font-bold text-white">List an NFT</h1>

      {/* Steps indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[
          { key: "select", label: "1. Select NFT" },
          { key: "configure", label: "2. Set Price" },
          { key: "sign", label: "3. Sign & List" },
        ].map((s, idx) => (
          <div key={s.key} className="flex items-center gap-2">
            {idx > 0 && <div className="h-px w-8 bg-[#333]" />}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === s.key
                  ? "bg-[#FFE135] text-black"
                  : step === "sign" && s.key === "configure"
                    ? "bg-[#FFE135]/20 text-[#FFE135]"
                    : step === "sign" && s.key === "select"
                      ? "bg-[#FFE135]/20 text-[#FFE135]"
                      : step === "configure" && s.key === "select"
                        ? "bg-[#FFE135]/20 text-[#FFE135]"
                        : "bg-[#222] text-[#555]"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Select NFT */}
      {step === "select" && (
        <div>
          {isLoadingNFTs ? (
            <div className="flex items-center gap-3 rounded-xl bg-[#111] p-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
              <p className="text-sm text-[#7DD3E8]">Loading your NFTs...</p>
            </div>
          ) : ownedNFTs.length === 0 ? (
            <div className="rounded-xl border border-[#333]/30 bg-[#111] p-10 text-center">
              <p className="mb-2 text-lg font-semibold text-white">No PizzaDAO NFTs found</p>
              <p className="text-sm text-[#7DD3E8]">
                You don&apos;t own any Rare Pizzas Box or Rare Pizzas NFTs in this wallet.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-[#7DD3E8]">
                Select an NFT to list ({ownedNFTs.length} found)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {ownedNFTs.map((nft) => (
                  <NFTCard
                    key={`${nft.collection.contract}-${nft.tokenId}`}
                    nft={nft}
                    selected={
                      selectedNFT?.collection.contract === nft.collection.contract &&
                      selectedNFT?.tokenId === nft.tokenId
                    }
                    onSelect={() => setSelectedNFT(nft)}
                  />
                ))}
              </div>
              {selectedNFT && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setStep("configure")}
                    className="rounded-lg bg-[#FFE135] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
                  >
                    Continue
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 2: Configure Listing */}
      {step === "configure" && selectedNFT && (
        <div className="mx-auto max-w-xl">
          {/* Selected NFT display */}
          <div className="mb-6 flex items-start gap-4 rounded-xl border border-[#333] bg-[#111] p-4">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0a0a0a]">
              {selectedNFT.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ipfsUrl(selectedNFT.image)}
                  alt={selectedNFT.name || `#${selectedNFT.tokenId}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl" role="img" aria-label="pizza">&#127829;</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#7DD3E8]">{selectedNFT.collection.name}</p>
              <h3 className="text-lg font-bold text-white">
                {selectedNFT.name || `#${selectedNFT.tokenId}`}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-white">
                  {CHAIN_LABELS[selectedNFT.collection.chainId]}
                </span>
              </div>
              {selectedNFT.toppings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedNFT.toppings.slice(0, 4).map((t) => (
                    <span key={t.sku} className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#7DD3E8]">
                      {t.name}
                    </span>
                  ))}
                  {selectedNFT.toppings.length > 4 && (
                    <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-[#555]">
                      +{selectedNFT.toppings.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => { setStep("select"); setSelectedNFT(null); }}
              className="text-xs text-[#555] transition-colors hover:text-white"
            >
              Change
            </button>
          </div>

          {/* Price Input */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#555]">
              Price ({CHAIN_CURRENCIES[selectedNFT.collection.chainId] || "ETH"})
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-lg font-semibold text-white outline-none placeholder:text-[#555] focus:border-[#FFE135]"
            />
          </div>

          {/* ERC1155 Quantity */}
          {selectedNFT.collection.standard === "ERC1155" && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#555]">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max={selectedNFT.quantity || 1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-lg font-semibold text-white outline-none placeholder:text-[#555] focus:border-[#FFE135]"
              />
            </div>
          )}

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
            <div className="mb-6 rounded-xl bg-[#0a0a0a] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#555]">
                Fee Breakdown
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7DD3E8]">Listed price</span>
                  <span className="text-white">
                    {priceInput} {CHAIN_CURRENCIES[selectedNFT.collection.chainId] || "ETH"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7DD3E8]">Marketplace fee ({bpsToPercent(MARKETPLACE_FEE_BPS)})</span>
                  <span className="text-white">
                    -{formatEther(feeBreakdown.marketplaceFee)} {CHAIN_CURRENCIES[selectedNFT.collection.chainId] || "ETH"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7DD3E8]">Creator royalty ({bpsToPercent(CREATOR_ROYALTY_BPS)})</span>
                  <span className="text-white">
                    -{formatEther(feeBreakdown.creatorRoyalty)} {CHAIN_CURRENCIES[selectedNFT.collection.chainId] || "ETH"}
                  </span>
                </div>
                <div className="mt-2 border-t border-[#333] pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">You receive</span>
                    <span className="text-lg font-bold text-[#FFE135]">
                      {formatEther(feeBreakdown.sellerReceives)} {CHAIN_CURRENCIES[selectedNFT.collection.chainId] || "ETH"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep("select")}
              className="flex-1 rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#555] hover:text-white"
            >
              Back
            </button>
            <button
              onClick={() => setStep("sign")}
              disabled={!parsedPrice}
              className="flex-1 rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Sign & Submit */}
      {step === "sign" && selectedNFT && (
        <div className="mx-auto max-w-xl">
          {/* Summary */}
          <div className="mb-6 rounded-xl border border-[#333] bg-[#111] p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Listing Summary</h2>

            <div className="mb-4 flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0a0a0a]">
                {selectedNFT.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ipfsUrl(selectedNFT.image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl" role="img" aria-label="pizza">&#127829;</span>
                )}
              </div>
              <div>
                <p className="text-xs text-[#7DD3E8]">{selectedNFT.collection.name}</p>
                <p className="font-semibold text-white">{selectedNFT.name || `#${selectedNFT.tokenId}`}</p>
                <p className="text-xs text-[#555]">{CHAIN_LABELS[selectedNFT.collection.chainId]}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#7DD3E8]">Price</span>
                <span className="font-semibold text-[#FFE135]">
                  {priceInput} {CHAIN_CURRENCIES[selectedNFT.collection.chainId] || "ETH"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7DD3E8]">Expires</span>
                <span className="text-white">{EXPIRATION_OPTIONS[expirationIdx].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7DD3E8]">Total fees</span>
                <span className="text-white">7.25%</span>
              </div>
            </div>
          </div>

          {/* Approval notice */}
          <div className="mb-4 rounded-lg border border-[#7DD3E8]/30 bg-[#7DD3E8]/10 px-4 py-3">
            <p className="text-xs text-[#7DD3E8]">
              <strong>Gasless listing:</strong> Creating a listing only requires an EIP-712 signature (no gas).
              If this is your first time listing from this collection, a one-time approval transaction will be required.
            </p>
          </div>

          {/* Status Messages */}
          {signState.status === "switching-chain" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">
                  Switching to {CHAIN_LABELS[selectedNFT.collection.chainId]}...
                </p>
              </div>
            </div>
          )}

          {signState.status === "checking-approval" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7DD3E8] border-t-transparent" />
                <p className="text-sm text-[#7DD3E8]">Checking approval status...</p>
              </div>
            </div>
          )}

          {signState.status === "approving" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">
                  One-time approval required. Confirm in wallet...
                </p>
              </div>
            </div>
          )}

          {signState.status === "signing" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
                <p className="text-sm text-[#FFE135]">Sign listing in wallet...</p>
              </div>
            </div>
          )}

          {signState.status === "submitting" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7DD3E8] border-t-transparent" />
                <p className="text-sm text-[#7DD3E8]">Submitting listing...</p>
              </div>
            </div>
          )}

          {signState.status === "success" && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-green-400">Listing created!</p>
              <p className="mt-1 text-xs text-green-400/80">
                Your NFT is now listed on the marketplace.
              </p>
              <Link
                href="/marketplace"
                className="mt-2 inline-block text-xs font-semibold text-[#FFE135] underline"
              >
                View on Marketplace
              </Link>
            </div>
          )}

          {signState.status === "error" && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{signState.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {signState.status === "success" ? (
              <Link
                href="/marketplace"
                className="flex flex-1 items-center justify-center rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80"
              >
                Go to Marketplace
              </Link>
            ) : (
              <>
                <button
                  onClick={() => { setStep("configure"); setSignState({ status: "idle" }); }}
                  disabled={isProcessing}
                  className="flex-1 rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-[#7DD3E8] transition-colors hover:border-[#555] hover:text-white disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateListing}
                  disabled={isProcessing}
                  className="flex-1 rounded-lg bg-[#FFE135] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                      Processing...
                    </span>
                  ) : (
                    "Sign & Create Listing"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
