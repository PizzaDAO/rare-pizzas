"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { useWalletToppings } from "@/hooks/useWalletToppings";
import { getClasses, getRarities } from "@/lib/toppings";
import {
  getImageUrl,
  getWoodTileUrl,
  RARITY_COLORS,
  OPENSEA_BASE_URL,
} from "@/lib/constants";
import {
  PIZZA_BOX_CONTRACT,
  RARE_PIZZAS_CONTRACT,
  BOX_ABI,
  PIZZA_ABI,
} from "@/lib/contracts";
import RarityBadge from "@/components/RarityBadge";
import { COLLECTIONS } from "@/lib/collections";
import type { OwnedTopping } from "@/lib/types";
import type { SendTarget } from "@/components/SendModal";

const BOX_COLLECTION = COLLECTIONS.find((c) => c.slug === "rare-pizzas-box")!;
const PIZZA_COLLECTION = COLLECTIONS.find((c) => c.slug === "rare-pizzas")!;

// Small "Send" affordance shown on card hover. Sits inside a `group relative`
// wrapper so it can overlay the OpenSea link without nesting a button in an anchor.
function SendButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-full bg-[#FFE135] px-2 py-1 text-[10px] font-bold text-black shadow-lg transition-transform hover:scale-105 group-hover:flex"
      aria-label="Send this NFT"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
      Send
    </button>
  );
}

// Star/favorite affordance shown on each NFT card. Sits inside the same
// `group relative` wrapper as SendButton, positioned top-left so the two never
// overlap.
//
// Interactive mode (`onClick` provided): filled gold when favorited (always
// visible); outline on hover when not. preventDefault/stopPropagation keep
// clicks off the OpenSea anchor.
//
// Read-only mode (`onClick` omitted): render a static filled gold star for
// favorited items, and render nothing for non-favorited items (so a viewer
// sees exactly what the owner starred, with no interactive control).
function StarButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const star = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={active ? "#FFE135" : "none"}
      stroke="#FFE135"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );

  // Read-only: only render a static star for favorited items.
  if (!onClick) {
    if (!active) return null;
    return (
      <span
        aria-label="Starred by the owner"
        className="absolute left-2 top-2 z-10 flex items-center justify-center rounded-full bg-black/60 p-1 shadow-lg"
      >
        {star}
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Unstar this NFT" : "Star this NFT"}
      className={`absolute left-2 top-2 z-10 items-center justify-center rounded-full bg-black/60 p-1 shadow-lg transition-transform hover:scale-110 ${
        active ? "flex" : "hidden group-hover:flex"
      }`}
    >
      {star}
    </button>
  );
}

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  superrare: "Super Rare",
  epic: "Epic",
  grail: "Grail",
};

const OPENSEA_BOX_URL = `https://opensea.io/assets/ethereum/${PIZZA_BOX_CONTRACT}`;
const OPENSEA_PIZZA_URL = `https://opensea.io/assets/ethereum/${RARE_PIZZAS_CONTRACT}`;

const PIZZA_ERC721_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Owned token ids ────────────────────────────────────────────────

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

const BOX_IPFS_GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

// Cache prefix bumped to `rp-boxd-` so older `{name,image}`-only entries from
// the previous cache shape don't shadow the new `{name,image,design}` shape.
const BOX_CACHE_PREFIX = "rp-boxd-";

function extractIpfsHash(url: string): string | null {
  const match = url.match(/\/ipfs\/(.+)$/);
  return match ? match[1] : null;
}

function ipfsImageUrl(url: string, gateway: string = BOX_IPFS_GATEWAYS[0]): string {
  const hash = extractIpfsHash(url);
  return hash ? `${gateway}${hash}` : url;
}

const FAVORITES_LIMIT = 10;

// ─── Pizza Boxes Section ────────────────────────────────────────────

type BoxMeta = { name: string; image: string; design: number | null };

type OwnedBox = { tokenId: number; redeemed?: boolean };

type DesignGroup = {
  design: number;
  name: string;
  image: string;
  tokens: OwnedBox[];
};

// A single owned token shown as a pill under a design card. Colored by redeemed
// state (green = unredeemed, gold/amber = redeemed). Links to OpenSea, and—when
// interactive—carries the per-token Star toggle and Send mini-button. The whole
// chip is a `group/chip relative` wrapper so the Star/Send overlays can sit on
// top of the anchor without nesting controls inside it.
function BoxTokenChip({
  tokenId,
  redeemed,
  imageUrl,
  name,
  isFavorite,
  toggleFavorite,
  onSend,
}: {
  tokenId: number;
  redeemed?: boolean;
  imageUrl: string;
  name: string;
  isFavorite: (key: string) => boolean;
  toggleFavorite?: (key: string) => void;
  onSend?: (t: SendTarget) => void;
}) {
  const favKey = `rare-pizzas-box:${tokenId}`;
  const fav = isFavorite(favKey);
  const redeemedKnown = redeemed !== undefined;
  const chipColor = !redeemedKnown
    ? "border-[#333] bg-[#1a1a1a] text-[#7DD3E8]"
    : redeemed
      ? "border-[#FFE135]/40 bg-[#FFE135]/10 text-[#FFE135]"
      : "border-green-500/40 bg-green-500/10 text-green-400";

  return (
    <span className="group/chip relative inline-flex">
      <a
        href={`${OPENSEA_BOX_URL}/${tokenId}`}
        target="_blank"
        rel="noopener noreferrer"
        title={
          redeemedKnown
            ? `#${tokenId} · ${redeemed ? "Redeemed" : "Unredeemed"}`
            : `#${tokenId}`
        }
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:brightness-125 ${chipColor}`}
      >
        {fav && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="#FFE135"
            stroke="#FFE135"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
        #{tokenId}
        {toggleFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(favKey);
            }}
            aria-pressed={fav}
            aria-label={fav ? "Unstar this box" : "Star this box"}
            className={`ml-0.5 ${fav ? "hidden" : "hidden group-hover/chip:inline-flex"}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFE135"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )}
        {onSend && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSend({
                collection: BOX_COLLECTION.slug,
                tokenContract: BOX_COLLECTION.contract,
                chainId: BOX_COLLECTION.chainId,
                tokenId: String(tokenId),
                standard: BOX_COLLECTION.standard,
                imageUrl,
                name: name || `Box #${tokenId}`,
              });
            }}
            aria-label="Send this box"
            className="ml-0.5 hidden text-black group-hover/chip:inline-flex"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFE135" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </a>
    </span>
  );
}

// One card per Box Design: the design art + name + "Design #N · <count>", with
// the owned token IDs rendered as chips below. Mirrors the previous box card's
// visual language (dark card, #FFE135 accent, IPFS image fallback).
function BoxDesignCard({
  group,
  isFavorite,
  toggleFavorite,
  onSend,
}: {
  group: DesignGroup;
  isFavorite: (key: string) => boolean;
  toggleFavorite?: (key: string) => void;
  onSend?: (t: SendTarget) => void;
}) {
  const imageUrl = group.image
    ? ipfsImageUrl(group.image)
    : "/images/pizza-box.gif";
  const count = group.tokens.length;

  return (
    <div className="rounded-xl border border-[#333]/50 bg-[#111] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={group.name || `Design #${group.design}`}
        className="mb-2 aspect-square w-full rounded-lg object-cover"
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== "/images/pizza-box.gif") {
            img.src = "/images/pizza-box.gif";
          }
        }}
      />
      {group.name && (
        <p className="truncate text-center text-xs font-semibold text-white">
          {group.name}
        </p>
      )}
      <p className="mt-0.5 text-center text-[10px] text-[#7DD3E8]">
        Design #{group.design} · {count} owned
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {group.tokens.map(({ tokenId, redeemed }) => (
          <BoxTokenChip
            key={tokenId}
            tokenId={tokenId}
            redeemed={redeemed}
            imageUrl={imageUrl}
            name={group.name}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onSend={onSend}
          />
        ))}
      </div>
    </div>
  );
}

function PizzaBoxesSection({
  address,
  isFavorite,
  toggleFavorite,
  onSend,
}: {
  address: `0x${string}`;
  isFavorite: (key: string) => boolean;
  toggleFavorite?: (key: string) => void;
  onSend?: (t: SendTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { total, tokenIds, isLoading } = useOwnedTokenIds(
    PIZZA_BOX_CONTRACT,
    BOX_ABI,
    !!address,
    address
  );

  // Check which boxes are redeemed
  const redeemedContracts = useMemo(() => {
    return tokenIds.map((tokenId) => ({
      address: RARE_PIZZAS_CONTRACT,
      abi: PIZZA_ABI,
      functionName: "isRedeemed" as const,
      args: [BigInt(tokenId)] as const,
    }));
  }, [tokenIds]);

  const { data: redeemedResults } = useReadContracts({
    contracts: redeemedContracts,
    query: { enabled: redeemedContracts.length > 0 },
  });

  // Batch-fetch tokenURI for each box
  const tokenURIContracts = useMemo(() => {
    return tokenIds.map((tokenId) => ({
      address: PIZZA_BOX_CONTRACT,
      abi: BOX_ABI,
      functionName: "tokenURI" as const,
      args: [BigInt(tokenId)] as const,
    }));
  }, [tokenIds]);

  const { data: tokenURIResults } = useReadContracts({
    contracts: tokenURIContracts,
    query: { enabled: tokenURIContracts.length > 0 },
  });

  // Fetch box metadata from IPFS. `design` is the on-chain "Box Design" trait
  // (1–100) pulled from the metadata `attributes`; it drives the grouping below.
  const [boxMeta, setBoxMeta] = useState<
    Record<number, BoxMeta>
  >({});

  useEffect(() => {
    if (!tokenURIResults || tokenURIResults.length === 0) return;

    let cancelled = false;

    async function fetchBoxMeta(
      tokenId: number,
      uri: string
    ): Promise<BoxMeta | null> {
      // Check sessionStorage cache
      try {
        const cached = sessionStorage.getItem(`${BOX_CACHE_PREFIX}${tokenId}`);
        if (cached) return JSON.parse(cached);
      } catch {}

      const hash = extractIpfsHash(uri);
      if (!hash) return null;

      for (const gateway of BOX_IPFS_GATEWAYS) {
        try {
          const res = await fetch(`${gateway}${hash}`, {
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const designAttr = Array.isArray(data.attributes)
            ? data.attributes.find(
                (a: { trait_type?: string; value?: unknown }) =>
                  a?.trait_type === "Box Design"
              )
            : undefined;
          const designNum = designAttr != null ? Number(designAttr.value) : NaN;
          const meta: BoxMeta = {
            name: data.name || "",
            image: data.image || "",
            design: Number.isFinite(designNum) ? designNum : null,
          };
          try {
            sessionStorage.setItem(
              `${BOX_CACHE_PREFIX}${tokenId}`,
              JSON.stringify(meta)
            );
          } catch {}
          return meta;
        } catch {
          continue;
        }
      }
      return null;
    }

    async function fetchAll() {
      const MAX_CONCURRENT = 5;
      const queue = tokenIds
        .map((id, i) => ({ tokenId: id, result: tokenURIResults![i] }))
        .filter((item) => item.result?.status === "success" && item.result.result);

      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT, queue.length) },
        async () => {
          while (queue.length > 0 && !cancelled) {
            const item = queue.shift();
            if (!item) break;
            const meta = await fetchBoxMeta(
              item.tokenId,
              item.result!.result as string
            );
            if (meta && !cancelled) {
              setBoxMeta((prev) => ({ ...prev, [item.tokenId]: meta }));
            }
          }
        }
      );
      await Promise.all(workers);
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [tokenIds, tokenURIResults]);

  const boxes = useMemo<OwnedBox[]>(() => {
    return tokenIds.map((tokenId, i) => ({
      tokenId,
      redeemed:
        redeemedResults?.[i]?.status === "success"
          ? (redeemedResults[i].result as boolean)
          : undefined,
    }));
  }, [tokenIds, redeemedResults]);

  // Group owned boxes by their on-chain Box Design (1–100). Tokens whose IPFS
  // metadata hasn't resolved yet (unknown design) are surfaced separately as a
  // small "loading N boxes…" affordance rather than an "unknown" bucket. Groups
  // update progressively as `boxMeta` fills in, keyed on design number to avoid
  // flicker.
  const { designGroups, pendingCount } = useMemo(() => {
    const groups = new Map<number, DesignGroup>();
    let pending = 0;

    for (const box of boxes) {
      const meta = boxMeta[box.tokenId];
      const design = meta?.design;
      if (meta == null || design == null) {
        pending += 1;
        continue;
      }
      let group = groups.get(design);
      if (!group) {
        group = { design, name: meta.name, image: meta.image, tokens: [] };
        groups.set(design, group);
      }
      group.tokens.push(box);
    }

    // Within each group: favorites-first, then ascending token id.
    for (const group of groups.values()) {
      group.tokens.sort((a, b) => {
        const aFav = isFavorite(`rare-pizzas-box:${a.tokenId}`) ? 0 : 1;
        const bFav = isFavorite(`rare-pizzas-box:${b.tokenId}`) ? 0 : 1;
        return aFav - bFav || a.tokenId - b.tokenId;
      });
    }

    return { designGroups: Array.from(groups.values()), pendingCount: pending };
  }, [boxes, boxMeta, isFavorite]);

  // Favorites-first at the group level: a group floats to the front if ANY owned
  // token in it is starred. Stable secondary ordering by design number.
  const sortedGroups = useMemo(() => {
    return designGroups
      .map((group, index) => ({ group, index }))
      .sort((a, b) => {
        const aFav = a.group.tokens.some((t) =>
          isFavorite(`rare-pizzas-box:${t.tokenId}`)
        )
          ? 0
          : 1;
        const bFav = b.group.tokens.some((t) =>
          isFavorite(`rare-pizzas-box:${t.tokenId}`)
        )
          ? 0
          : 1;
        return aFav - bFav || a.group.design - b.group.design;
      })
      .map((entry) => entry.group);
  }, [designGroups, isFavorite]);

  const visibleGroups = expanded
    ? sortedGroups
    : sortedGroups.slice(0, FAVORITES_LIMIT);

  if (total === 0 && !isLoading) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-xl font-semibold text-white">
        My Pizza Boxes
      </h2>
      <p className="mb-4 text-sm text-[#7DD3E8]">
        {total} box{total !== 1 ? "es" : ""} · {sortedGroups.length} design
        {sortedGroups.length !== 1 ? "s" : ""}
      </p>
      {isLoading ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#111] p-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
          <p className="text-sm text-[#7DD3E8]">Loading boxes...</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visibleGroups.map((group) => (
            <BoxDesignCard
              key={group.design}
              group={group}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              onSend={onSend}
            />
          ))}
        </div>
        {pendingCount > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#111] p-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
            <p className="text-xs text-[#7DD3E8]">
              Loading {pendingCount} box{pendingCount !== 1 ? "es" : ""}…
            </p>
          </div>
        )}
        {sortedGroups.length > FAVORITES_LIMIT && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 rounded-full border border-[#FFE135] px-4 py-1.5 text-sm font-semibold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10"
          >
            {expanded ? "Show less" : `Show all (${sortedGroups.length})`}
          </button>
        )}
        </>
      )}
    </section>
  );
}

// ─── Rare Pizzas Section ────────────────────────────────────────────

function RarePizzasSection({
  address,
  isFavorite,
  toggleFavorite,
  onSend,
}: {
  address: `0x${string}`;
  isFavorite: (key: string) => boolean;
  toggleFavorite?: (key: string) => void;
  onSend?: (t: SendTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { total, tokenIds, isLoading } = useOwnedTokenIds(
    RARE_PIZZAS_CONTRACT,
    PIZZA_ERC721_ABI,
    !!address,
    address
  );

  // Stable favorites-first ordering for owned pizzas.
  const sortedTokenIds = useMemo(() => {
    return tokenIds
      .map((tokenId, index) => ({ tokenId, index }))
      .sort((a, b) => {
        const aFav = isFavorite(`rare-pizzas:${a.tokenId}`) ? 0 : 1;
        const bFav = isFavorite(`rare-pizzas:${b.tokenId}`) ? 0 : 1;
        return aFav - bFav || a.index - b.index;
      })
      .map((entry) => entry.tokenId);
  }, [tokenIds, isFavorite]);

  const visibleTokenIds = expanded
    ? sortedTokenIds
    : sortedTokenIds.slice(0, FAVORITES_LIMIT);

  if (total === 0 && !isLoading) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-xl font-semibold text-white">
        My Rare Pizzas
      </h2>
      <p className="mb-4 text-sm text-[#7DD3E8]">{total} pizza{total !== 1 ? "s" : ""}</p>
      {isLoading ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#111] p-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
          <p className="text-sm text-[#7DD3E8]">Loading pizzas...</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {visibleTokenIds.map((tokenId) => (
            <div key={tokenId} className="group relative">
              <StarButton
                active={isFavorite(`rare-pizzas:${tokenId}`)}
                onClick={
                  toggleFavorite
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(`rare-pizzas:${tokenId}`);
                      }
                    : undefined
                }
              />
              {onSend && (
                <SendButton
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSend({
                      collection: PIZZA_COLLECTION.slug,
                      tokenContract: PIZZA_COLLECTION.contract,
                      chainId: PIZZA_COLLECTION.chainId,
                      tokenId: String(tokenId),
                      standard: PIZZA_COLLECTION.standard,
                      imageUrl: `/pizzas/${tokenId}.webp`,
                      name: `Rare Pizza #${tokenId}`,
                    });
                  }}
                />
              )}
              <a
                href={`${OPENSEA_PIZZA_URL}/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-[#333]/50 transition-all hover:border-[#FFE135]/50"
                title={`Rare Pizza #${tokenId}`}
              >
                <img
                  src={`/pizzas/${tokenId}.webp`}
                  alt={`Rare Pizza #${tokenId}`}
                  width={200}
                  height={200}
                  className="h-auto w-full transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <p className="bg-[#111] py-1.5 text-center text-xs font-semibold text-white">
                  #{tokenId}
                </p>
              </a>
            </div>
          ))}
        </div>
        {sortedTokenIds.length > FAVORITES_LIMIT && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 rounded-full border border-[#FFE135] px-4 py-1.5 text-sm font-semibold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10"
          >
            {expanded ? "Show less" : `Show all (${sortedTokenIds.length})`}
          </button>
        )}
        </>
      )}
    </section>
  );
}

// ─── Topping Card ───────────────────────────────────────────────────

function OwnedToppingCard({
  owned,
  index,
}: {
  owned: OwnedTopping;
  index: number;
}) {
  const [imgError, setImgError] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const tileIndex = index || (owned.topping.sku % 24);

  return (
    <div className="group" style={{ perspective: "1000px" }}>
      <div
        className="relative transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front face */}
        <div style={{ backfaceVisibility: "hidden" }}>
          <Link href={`/topping/${owned.topping.sku}`}>
            <div
              className="relative rounded-xl bg-cover bg-center p-3 transition-all duration-200 hover:scale-[1.02] hover:brightness-110"
              style={{
                backgroundImage: `url(${getWoodTileUrl(tileIndex)})`,
              }}
            >
              {owned.count > 1 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsFlipped(true);
                  }}
                  className="absolute right-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#FFE135] px-2 text-xs font-bold text-black shadow-lg transition-transform hover:scale-110"
                  aria-label="Show pizzas with this topping"
                >
                  x{owned.count}
                </button>
              )}
              <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                {imgError ? (
                  <div className="flex h-full w-full items-center justify-center bg-[#111] text-6xl">
                    <span role="img" aria-label="pizza">
                      &#127829;
                    </span>
                  </div>
                ) : (
                  <Image
                    src={getImageUrl(owned.topping.image)}
                    alt={owned.topping.name}
                    width={400}
                    height={400}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    onError={() => setImgError(true)}
                  />
                )}
              </div>
              <div className="mt-3 space-y-2">
                <h3 className="truncate text-sm font-semibold text-white">
                  {owned.topping.name}
                </h3>
                <p className="truncate text-xs text-[#7DD3E8]">
                  {owned.topping.class}
                </p>
                <RarityBadge rarity={owned.topping.rarity} />
              </div>
            </div>
          </Link>
        </div>

        {/* Back face */}
        <div
          className="absolute inset-0 rounded-xl bg-cover bg-center p-4"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundImage: `url(${getWoodTileUrl(tileIndex)})`,
          }}
        >
          <div className="flex h-full flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="truncate text-sm font-semibold text-white">
                {owned.topping.name}
              </h3>
              <button
                onClick={() => setIsFlipped(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/60 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
                aria-label="Flip back"
              >
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
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>
            <p className="mb-2 text-xs text-[#7DD3E8]">
              Found on {owned.tokenIds.length} pizza
              {owned.tokenIds.length !== 1 ? "s" : ""}:
            </p>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {owned.tokenIds.map((tokenId) => (
                <a
                  key={tokenId}
                  href={`${OPENSEA_BASE_URL}/${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-xs text-white transition-colors hover:bg-black/60"
                >
                  <span>Pizza #{tokenId}</span>
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
                    className="ml-auto shrink-0 text-[#7DD3E8]"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────

function LoadingSkeleton({
  loaded,
  total,
}: {
  loaded: number;
  total: number;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#111] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
          <p className="text-[#7DD3E8]">
            Loading pizza {loaded} of {total}...
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#333]">
          <div
            className="h-full rounded-full bg-[#FFE135] transition-all duration-300"
            style={{
              width: total > 0 ? `${(loaded / total) * 100}%` : "0%",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Toppings Section ───────────────────────────────────────────────

function ToppingsSection({ address }: { address: `0x${string}` }) {
  const {
    isLoading,
    isLoadingOnChain,
    isLoadingMetadata,
    error,
    ownedToppings,
    totalPizzas,
    loadedPizzas,
    unmatchedTraits,
  } = useWalletToppings(address);

  const [classFilter, setClassFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");

  const classes = getClasses();
  const rarities = getRarities();

  const ownedClasses = useMemo(() => {
    const classSet = new Set(ownedToppings.map((o) => o.topping.class));
    return classes.filter((c) => classSet.has(c.name));
  }, [ownedToppings, classes]);

  const filteredToppings = useMemo(() => {
    let result = ownedToppings;
    if (classFilter) {
      result = result.filter((o) => o.topping.class === classFilter);
    }
    if (rarityFilter) {
      result = result.filter((o) => o.topping.rarity === rarityFilter);
    }
    return result;
  }, [ownedToppings, classFilter, rarityFilter]);

  const sortedToppings = useMemo(() => {
    const rarityOrder: Record<string, number> = {
      grail: 5,
      epic: 4,
      superrare: 3,
      rare: 2,
      uncommon: 1,
      common: 0,
    };
    return [...filteredToppings].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (
        (rarityOrder[b.topping.rarity] ?? 0) -
        (rarityOrder[a.topping.rarity] ?? 0)
      );
    });
  }, [filteredToppings]);

  const rarityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of ownedToppings) {
      const r = o.topping.rarity;
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [ownedToppings]);

  if (isLoadingOnChain) {
    return (
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-white">My Toppings</h2>
        <div className="flex items-center gap-3 rounded-xl bg-[#111] p-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
          <p className="text-sm text-[#7DD3E8]">Scanning for toppings...</p>
        </div>
      </section>
    );
  }

  if (totalPizzas === 0 && !isLoading) return null;

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-white">My Toppings</h2>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {isLoadingMetadata && (
        <LoadingSkeleton loaded={loadedPizzas} total={totalPizzas} />
      )}

      {!isLoadingMetadata && ownedToppings.length === 0 && totalPizzas > 0 && (
        <div className="rounded-xl bg-[#111] p-6">
          <p className="text-[#7DD3E8]">
            Found {totalPizzas} pizza{totalPizzas !== 1 ? "s" : ""} but could
            not load topping data.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-[#FFE135] px-4 py-2 text-sm font-medium text-black hover:bg-[#FFE135]/80"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoadingMetadata && ownedToppings.length > 0 && (
        <>
          <div className="mb-4 rounded-xl bg-[#111] p-4">
            <p className="mb-2 text-sm font-semibold text-white">
              {ownedToppings.length} unique topping
              {ownedToppings.length !== 1 ? "s" : ""} across {totalPizzas}{" "}
              pizza{totalPizzas !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(rarityBreakdown).map(([rarity, count]) => (
                <span
                  key={rarity}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: `${RARITY_COLORS[rarity] || "#9CA3AF"}55`,
                    color: RARITY_COLORS[rarity] || "#9CA3AF",
                  }}
                >
                  {count} {RARITY_LABELS[rarity] || rarity}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
            >
              <option value="">All Classes</option>
              {ownedClasses.map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
            >
              <option value="">All Rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {RARITY_LABELS[r] || r}
                </option>
              ))}
            </select>

            <p className="text-sm text-[#7DD3E8]">
              Showing {sortedToppings.length} of {ownedToppings.length}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedToppings.map((owned, i) => (
              <OwnedToppingCard
                key={owned.topping.sku}
                owned={owned}
                index={i}
              />
            ))}
          </div>

          {unmatchedTraits.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer text-sm text-[#555] hover:text-[#7DD3E8]">
                {unmatchedTraits.length} unmatched trait
                {unmatchedTraits.length !== 1 ? "s" : ""} (debug info)
              </summary>
              <div className="mt-2 rounded-xl bg-[#111] p-4">
                <div className="space-y-1">
                  {unmatchedTraits.map((t, i) => (
                    <p key={i} className="text-xs text-[#555]">
                      {t.trait_type}: {t.value}
                    </p>
                  ))}
                </div>
              </div>
            </details>
          )}
        </>
      )}

      {isLoadingMetadata && ownedToppings.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Found so far: {ownedToppings.length} unique toppings
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ownedToppings.map((owned, i) => (
              <OwnedToppingCard
                key={owned.topping.sku}
                owned={owned}
                index={i}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Collection View ────────────────────────────────────────────────

export interface CollectionViewProps {
  address: `0x${string}`;
  isFavorite: (key: string) => boolean;
  toggleFavorite?: (key: string) => void; // omitted => read-only stars
  onSend?: (t: SendTarget) => void; // omitted => no Send buttons
}

export default function CollectionView({
  address,
  isFavorite,
  toggleFavorite,
  onSend,
}: CollectionViewProps) {
  return (
    <div>
      <PizzaBoxesSection
        address={address}
        isFavorite={isFavorite}
        toggleFavorite={toggleFavorite}
        onSend={onSend}
      />
      <RarePizzasSection
        address={address}
        isFavorite={isFavorite}
        toggleFavorite={toggleFavorite}
        onSend={onSend}
      />
      <ToppingsSection address={address} />
    </div>
  );
}
