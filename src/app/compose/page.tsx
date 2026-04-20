"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useReadContract } from "wagmi";
import {
  RARE_PIZZAS_CONTRACT,
  ERC721_ENUMERABLE_ABI,
  EXCLUDED_TRAIT_TYPES,
  OPENSEA_BASE_URL,
} from "@/lib/constants";
import { matchTopping, getAllToppings } from "@/lib/toppings";
import { getToppingEmoji } from "@/lib/topping-emojis";
import type { Topping, NFTMetadata, NFTAttribute, OwnerLookupResult } from "@/lib/types";
import pizzaIndex from "@/data/pizza-index.json";

// --- IPFS helpers (same pattern as useWalletToppings) ---

const IPFS_GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

function ipfsToHttp(uri: string, gateway: string = IPFS_GATEWAYS[0]): string {
  if (uri.startsWith("ipfs://")) {
    return `${gateway}${uri.slice(7)}`;
  }
  return uri;
}

async function fetchMetadataWithRetry(
  uri: string,
  retries = 2
): Promise<NFTMetadata> {
  for (const gateway of IPFS_GATEWAYS) {
    const url = ipfsToHttp(uri, gateway);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as NFTMetadata;
      } catch {
        if (attempt === retries) break;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw new Error("All IPFS gateways failed");
}

// --- Owner lookup via serverless function ---

async function lookupOwner(tokenId: number): Promise<OwnerLookupResult> {
  const res = await fetch(`/api/opensea-owner?tokenId=${tokenId}`);
  if (!res.ok) throw new Error(`Owner lookup failed (${res.status})`);
  return res.json();
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// --- Class ordering for tweet (crust first, sauce, cheese, etc.) ---

const CLASS_ORDER: Record<string, number> = {
  Crust: 0,
  Sauce: 1,
  Cheese: 2,
  Meat: 3,
  Fruit: 4,
  Vegetable: 5,
  Pepper: 6,
  Fungi: 7,
  Nuts: 8,
  Seafood: 9,
  Bugs: 10,
  Flowers: 11,
  "Herbs & Spices": 12,
  Eggs: 13,
  Space: 14,
  Snacks: 15,
  Random: 16,
  Drizzle: 17,
};

function sortToppings(toppings: Topping[]): Topping[] {
  return [...toppings].sort(
    (a, b) => (CLASS_ORDER[a.class] ?? 99) - (CLASS_ORDER[b.class] ?? 99)
  );
}

// --- Tweet generation ---

function generateTweet(
  tokenId: number,
  toppings: Topping[],
  ownerHandle: string
): string {
  const sorted = sortToppings(toppings);
  const lines: string[] = [];

  // Header
  lines.push("\u{1F48E}\u{1F355}\u{1F60B}");
  const ownerPart = ownerHandle
    ? `, owned by @${ownerHandle.replace("@", "")}`
    : "";
  lines.push(`Our new pfp is Rare Pizza #${tokenId}${ownerPart}. Would you eat it?`);

  // Toppings with emojis
  for (const t of sorted) {
    const emoji = getToppingEmoji(t.name, t.class);
    lines.push(`${emoji} ${t.name}`);
  }

  // Artist tags (unique Twitter handles only)
  const handles = new Set<string>();
  for (const t of sorted) {
    if (t.artistTwitter && t.artistTwitter !== "n/a" && t.artistTwitter !== "N/A") {
      const clean = t.artistTwitter.replace("@", "");
      handles.add(clean);
    }
  }
  if (handles.size > 0) {
    lines.push(`\u{1F3A8} ${[...handles].map((h) => `@${h}`).join(" ")}`);
  }

  return lines.join("\n");
}

// --- Spotlight tweet generation ---

function generateSpotlightTweet(topping: Topping): string {
  const emoji = getToppingEmoji(topping.name, topping.class);
  const lines: string[] = [];

  lines.push(`\u{1F355}\u{2728} Topping Spotlight: ${emoji} ${topping.name}`);
  lines.push("");
  lines.push(topping.description);
  lines.push("");

  // Rarity formatting: "common" → "Common", "superrare" → "Super Rare"
  const rarityLabel = topping.rarity === "superrare"
    ? "Super Rare"
    : topping.rarity.charAt(0).toUpperCase() + topping.rarity.slice(1);

  // Pizza count from pizza-index
  const count = (pizzaIndex as Record<string, number[]>)[String(topping.sku)]?.length ?? 0;

  lines.push(`\u{1F4CA} Rarity: ${rarityLabel} \u{2022} Found on ${count} pizzas`);

  // Artist line
  const hasTwitter = topping.artistTwitter && topping.artistTwitter !== "n/a" && topping.artistTwitter !== "N/A";
  const artistTag = hasTwitter
    ? `${topping.artist} @${topping.artistTwitter!.replace("@", "")}`
    : topping.artist;
  lines.push(`\u{1F3A8} Art by ${artistTag}`);
  lines.push("");
  lines.push(`rarepizzas.com/topping/${topping.sku}`);

  return lines.join("\n");
}

// --- Component ---

type ComposeMode = "pizza" | "spotlight";
type OwnerLookupStatus = "idle" | "loading" | "found" | "not-found" | "error";

export default function ComposePage() {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [activeTokenId, setActiveTokenId] = useState<number | null>(null);
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [unmatchedTraits, setUnmatchedTraits] = useState<NFTAttribute[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerHandle, setOwnerHandle] = useState("");
  const [ownerAutoFilled, setOwnerAutoFilled] = useState(false);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [ownerLookupStatus, setOwnerLookupStatus] = useState<OwnerLookupStatus>("idle");
  const [copied, setCopied] = useState(false);
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);
  const [isMarkingPosted, setIsMarkingPosted] = useState(false);
  const [markPostedStatus, setMarkPostedStatus] = useState<"idle" | "success" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Spotlight mode state
  const [mode, setMode] = useState<ComposeMode>("pizza");
  const [selectedTopping, setSelectedTopping] = useState<Topping | null>(null);
  const [toppingSearch, setToppingSearch] = useState("");
  const [spotlightCopied, setSpotlightCopied] = useState(false);
  const spotlightTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Step 1: Read tokenURI from contract
  const {
    data: tokenURI,
    isLoading: isLoadingURI,
    error: uriError,
  } = useReadContract({
    address: RARE_PIZZAS_CONTRACT,
    abi: ERC721_ENUMERABLE_ABI,
    functionName: "tokenURI",
    args: activeTokenId !== null ? [BigInt(activeTokenId)] : undefined,
    query: {
      enabled: activeTokenId !== null,
    },
  });

  // Step 2: Fetch IPFS metadata when URI is available
  useEffect(() => {
    if (!tokenURI || typeof tokenURI !== "string") return;

    let cancelled = false;
    setIsLoadingMeta(true);
    setError(null);

    fetchMetadataWithRetry(tokenURI)
      .then((meta) => {
        if (cancelled) return;
        setMetadata(meta);

        // Match toppings from attributes
        const matched: Topping[] = [];
        const unmatched: NFTAttribute[] = [];
        if (meta.attributes) {
          for (const attr of meta.attributes) {
            if (EXCLUDED_TRAIT_TYPES.has(attr.trait_type)) continue;
            const t = matchTopping(attr);
            if (t) matched.push(t);
            else unmatched.push(attr);
          }
        }
        setToppings(matched);
        setUnmatchedTraits(unmatched);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load metadata");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenURI]);

  // Step 3: Look up owner via OpenSea when activeTokenId changes
  useEffect(() => {
    if (activeTokenId === null) return;

    let cancelled = false;
    setOwnerLookupStatus("loading");
    setOwnerAddress(null);
    setOwnerAutoFilled(false);

    lookupOwner(activeTokenId)
      .then((result) => {
        if (cancelled) return;
        setOwnerAddress(result.ownerAddress);
        if (result.twitter) {
          setOwnerHandle(result.twitter);
          setOwnerAutoFilled(true);
          setOwnerLookupStatus("found");
        } else {
          setOwnerLookupStatus("not-found");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOwnerLookupStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTokenId]);

  const handleLoad = useCallback(() => {
    const id = parseInt(tokenIdInput, 10);
    if (isNaN(id) || id < 0) {
      setError("Enter a valid token ID");
      return;
    }
    setMetadata(null);
    setToppings([]);
    setUnmatchedTraits([]);
    setError(null);
    setOwnerHandle("");
    setOwnerAutoFilled(false);
    setOwnerAddress(null);
    setOwnerLookupStatus("idle");
    setMarkPostedStatus("idle");
    setActiveTokenId(id);
  }, [tokenIdInput]);

  const handleOwnerHandleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOwnerHandle(e.target.value);
    setOwnerAutoFilled(false);
  }, []);

  const handleRandom = useCallback(async () => {
    setIsLoadingRandom(true);
    setError(null);
    try {
      const res = await fetch("/api/random-pizza");
      if (!res.ok) throw new Error(`Random pizza failed (${res.status})`);
      const data = await res.json();
      setTokenIdInput(String(data.tokenId));
      // Reset state and trigger load
      setMetadata(null);
      setToppings([]);
      setUnmatchedTraits([]);
      setOwnerHandle("");
      setOwnerAutoFilled(false);
      setOwnerAddress(null);
      setOwnerLookupStatus("idle");
      setMarkPostedStatus("idle");
      setActiveTokenId(data.tokenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get random pizza");
    } finally {
      setIsLoadingRandom(false);
    }
  }, []);

  const handleMarkPosted = useCallback(async () => {
    if (activeTokenId === null) return;
    setIsMarkingPosted(true);
    setMarkPostedStatus("idle");
    try {
      const res = await fetch("/api/mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: activeTokenId }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setMarkPostedStatus("success");
    } catch {
      setMarkPostedStatus("error");
    } finally {
      setIsMarkingPosted(false);
    }
  }, [activeTokenId]);

  const isLoading = isLoadingURI || isLoadingMeta || isLoadingRandom;

  const tweetText =
    activeTokenId !== null && toppings.length > 0
      ? generateTweet(activeTokenId, toppings, ownerHandle)
      : "";

  const imageUrl = metadata?.image ? ipfsToHttp(metadata.image) : null;

  const handleCopy = useCallback(async () => {
    if (!tweetText) return;
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select textarea content
      textareaRef.current?.select();
    }
  }, [tweetText]);

  const tweetIntentUrl = tweetText
    ? `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    : "";

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [tweetText]);

  // --- Spotlight mode logic ---

  const allToppings = getAllToppings();
  const filteredToppings = toppingSearch.trim()
    ? allToppings.filter((t) => t.name.toLowerCase().includes(toppingSearch.toLowerCase()))
    : [];

  const handleRandomTopping = useCallback(() => {
    const all = getAllToppings();
    const random = all[Math.floor(Math.random() * all.length)];
    setSelectedTopping(random);
    setToppingSearch("");
  }, []);

  const spotlightTweetText = selectedTopping
    ? generateSpotlightTweet(selectedTopping)
    : "";

  const spotlightTweetIntentUrl = spotlightTweetText
    ? `https://x.com/intent/tweet?text=${encodeURIComponent(spotlightTweetText)}`
    : "";

  const handleSpotlightCopy = useCallback(async () => {
    if (!spotlightTweetText) return;
    try {
      await navigator.clipboard.writeText(spotlightTweetText);
      setSpotlightCopied(true);
      setTimeout(() => setSpotlightCopied(false), 2000);
    } catch {
      spotlightTextareaRef.current?.select();
    }
  }, [spotlightTweetText]);

  // Auto-resize spotlight textarea
  useEffect(() => {
    if (spotlightTextareaRef.current) {
      spotlightTextareaRef.current.style.height = "auto";
      spotlightTextareaRef.current.style.height = `${spotlightTextareaRef.current.scrollHeight}px`;
    }
  }, [spotlightTweetText]);

  // Owner handle label suffix
  const ownerLabelSuffix = (() => {
    switch (ownerLookupStatus) {
      case "loading":
        return <span className="normal-case text-[#555]">(looking up...)</span>;
      case "found":
        return ownerAutoFilled
          ? <span className="normal-case text-green-400">(via OpenSea)</span>
          : <span className="normal-case text-[#555]">(optional)</span>;
      case "not-found":
      case "error":
      default:
        return <span className="normal-case text-[#555]">(optional)</span>;
    }
  })();

  return (
    <div>
      <section className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">
          Tweet Composer
        </h1>
        <p className="text-[#7DD3E8]">
          {mode === "pizza"
            ? "Generate a tweet for any Rare Pizza by token ID."
            : "Highlight a single topping with its art, stats, and artist credit."}
        </p>
      </section>

      {/* Mode Toggle */}
      <div className="mb-8 flex gap-1 rounded-lg bg-[#111] p-1 border border-[#333] w-fit">
        <button
          onClick={() => setMode("pizza")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            mode === "pizza"
              ? "bg-[#FFE135] text-black"
              : "text-[#888] hover:text-white"
          }`}
        >
          Pizza PFP
        </button>
        <button
          onClick={() => setMode("spotlight")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            mode === "spotlight"
              ? "bg-[#FFE135] text-black"
              : "text-[#888] hover:text-white"
          }`}
        >
          Topping Spotlight
        </button>
      </div>

      {mode === "pizza" && (
      <>
      {/* Input */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
            Pizza Token ID
          </label>
          <input
            type="number"
            min="0"
            value={tokenIdInput}
            onChange={(e) => setTokenIdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="e.g. 1054"
            className="w-full rounded-lg border border-[#333] bg-[#111] px-4 py-2.5 text-white placeholder-[#555] outline-none focus:border-[#FFE135] sm:max-w-xs"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
            Owner @ Handle {ownerLabelSuffix}
          </label>
          <input
            type="text"
            value={ownerHandle}
            onChange={handleOwnerHandleChange}
            disabled={ownerLookupStatus === "loading"}
            placeholder={ownerLookupStatus === "loading" ? "Looking up owner..." : "e.g. dark0eth"}
            className="w-full rounded-lg border border-[#333] bg-[#111] px-4 py-2.5 text-white placeholder-[#555] outline-none focus:border-[#FFE135] disabled:opacity-50 sm:max-w-xs"
          />
          {/* Show wallet address + OpenSea link when no X handle found */}
          {ownerLookupStatus === "not-found" && ownerAddress && (
            <p className="mt-1 text-xs text-[#555]">
              Owner: {truncateAddress(ownerAddress)}{" "}
              <a
                href={`https://opensea.io/${ownerAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7DD3E8] hover:underline"
              >
                OpenSea profile
              </a>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLoad}
            disabled={isLoading || !tokenIdInput}
            className="rounded-lg bg-[#FFE135] px-6 py-2.5 font-semibold text-black transition-colors hover:bg-[#FFE135]/80 disabled:opacity-50"
          >
            {isLoadingURI || isLoadingMeta ? "Loading..." : "Load Pizza"}
          </button>
          <button
            onClick={handleRandom}
            disabled={isLoading}
            className="rounded-lg border border-[#FFE135] px-4 py-2.5 font-semibold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10 disabled:opacity-50"
          >
            {isLoadingRandom ? (
              "Rolling..."
            ) : (
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="3" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="16" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
                Random
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {(error || uriError) && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error || uriError?.message || "Failed to load pizza"}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="mb-6 text-sm text-[#7DD3E8]">
          {isLoadingURI ? "Reading contract..." : "Fetching metadata from IPFS..."}
        </div>
      )}

      {/* Results */}
      {tweetText && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Pizza Image */}
          <div>
            {imageUrl && (
              <div className="mb-4 overflow-hidden rounded-xl border border-[#333]/50">
                <Image
                  src={imageUrl}
                  alt={metadata?.name || `Rare Pizza #${activeTokenId}`}
                  width={600}
                  height={600}
                  className="h-auto w-full"
                  unoptimized
                />
              </div>
            )}
            {imageUrl && (
              <a
                href={imageUrl}
                download={`rare-pizza-${activeTokenId}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[#333] bg-[#111] px-4 py-2 text-sm text-[#7DD3E8] transition-colors hover:bg-[#222] hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Image
              </a>
            )}
          </div>

          {/* Tweet Text */}
          <div>
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-[#FFE135]">
              Tweet
            </label>
            <textarea
              ref={textareaRef}
              value={tweetText}
              readOnly
              className="mb-4 w-full resize-none rounded-lg border border-[#333] bg-[#111] p-4 font-mono text-sm leading-relaxed text-white outline-none"
              rows={10}
            />

            <div className="mb-6 text-right text-xs text-[#555]">
              {tweetText.length} / 280 characters
              {tweetText.length > 280 && (
                <span className="ml-2 text-red-400">
                  (over limit by {tweetText.length - 280})
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className="rounded-lg border border-[#333] bg-[#111] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#222]"
              >
                {copied ? "Copied!" : "Copy Text"}
              </button>
              <a
                href={tweetIntentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#1DA1F2] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A8CD8]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Post on X
              </a>
              <button
                onClick={handleMarkPosted}
                disabled={isMarkingPosted || markPostedStatus === "success"}
                className="rounded-lg border border-green-500/50 bg-green-500/10 px-5 py-2.5 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
              >
                {isMarkingPosted
                  ? "Marking..."
                  : markPostedStatus === "success"
                    ? "Marked — won\u2019t suggest for 30 days"
                    : "Mark Posted"}
              </button>
            </div>
            {markPostedStatus === "error" && (
              <p className="mt-2 text-xs text-red-400">
                Failed to mark as posted. KV store may not be configured.
              </p>
            )}

            {/* Unmatched traits warning */}
            {unmatchedTraits.length > 0 && (
              <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
                <p className="mb-1 font-semibold">
                  {unmatchedTraits.length} unmatched trait{unmatchedTraits.length !== 1 ? "s" : ""}:
                </p>
                {unmatchedTraits.map((t, i) => (
                  <p key={i} className="text-xs text-yellow-400/70">
                    {t.trait_type}: {t.value}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {mode === "spotlight" && (
        <>
          {/* Topping Search + Random */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative flex-1">
              <label className="mb-1 block text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
                Search Toppings
              </label>
              <input
                type="text"
                value={toppingSearch}
                onChange={(e) => setToppingSearch(e.target.value)}
                placeholder="e.g. Pepperoni, Lobster, Gold Flake..."
                className="w-full rounded-lg border border-[#333] bg-[#111] px-4 py-2.5 text-white placeholder-[#555] outline-none focus:border-[#FFE135] sm:max-w-md"
              />
              {/* Dropdown */}
              {toppingSearch.trim() && filteredToppings.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[#333] bg-[#111] sm:max-w-md">
                  {filteredToppings.slice(0, 20).map((t) => (
                    <button
                      key={t.sku}
                      onClick={() => {
                        setSelectedTopping(t);
                        setToppingSearch("");
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-[#222]"
                    >
                      <span>{getToppingEmoji(t.name, t.class)}</span>
                      <span>{t.name}</span>
                      <span className="ml-auto text-xs text-[#555]">{t.class}</span>
                    </button>
                  ))}
                </div>
              )}
              {toppingSearch.trim() && filteredToppings.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#333] bg-[#111] px-4 py-3 text-sm text-[#555] sm:max-w-md">
                  No toppings found
                </div>
              )}
            </div>
            <button
              onClick={handleRandomTopping}
              className="rounded-lg border border-[#FFE135] px-4 py-2.5 font-semibold text-[#FFE135] transition-colors hover:bg-[#FFE135]/10"
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="3" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="16" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
                Random Topping
              </span>
            </button>
          </div>

          {/* Selected Topping Result */}
          {selectedTopping && spotlightTweetText && (
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Topping Art */}
              <div>
                <div className="mb-4 overflow-hidden rounded-xl border border-[#333]/50">
                  <Image
                    src={`/art/${selectedTopping.sku}.webp`}
                    alt={selectedTopping.name}
                    width={600}
                    height={600}
                    className="h-auto w-full"
                  />
                </div>
                <p className="text-sm text-[#555]">
                  {getToppingEmoji(selectedTopping.name, selectedTopping.class)} {selectedTopping.name} — {selectedTopping.class}
                </p>
              </div>

              {/* Tweet Text */}
              <div>
                <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-[#FFE135]">
                  Tweet
                </label>
                <textarea
                  ref={spotlightTextareaRef}
                  value={spotlightTweetText}
                  readOnly
                  className="mb-4 w-full resize-none rounded-lg border border-[#333] bg-[#111] p-4 font-mono text-sm leading-relaxed text-white outline-none"
                  rows={10}
                />

                <div className="mb-6 text-right text-xs text-[#555]">
                  {spotlightTweetText.length} / 280 characters
                  {spotlightTweetText.length > 280 && (
                    <span className="ml-2 text-red-400">
                      (over limit by {spotlightTweetText.length - 280})
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSpotlightCopy}
                    className="rounded-lg border border-[#333] bg-[#111] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#222]"
                  >
                    {spotlightCopied ? "Copied!" : "Copy Text"}
                  </button>
                  <a
                    href={spotlightTweetIntentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1DA1F2] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A8CD8]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Post on X
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
