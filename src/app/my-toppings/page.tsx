"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useFavorites } from "@/hooks/useFavorites";
import { encodeStars } from "@/lib/share";
import CollectionView from "@/components/collection/CollectionView";
import type { SendTarget } from "@/components/SendModal";

const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((mod) => mod.ConnectButton),
  { ssr: false }
);

// Lazy-load SendModal (client-only, heavy dependency on seaport/ethers)
const SendModal = dynamic(() => import("@/components/SendModal"), { ssr: false });

// ─── Wallet Prompt ──────────────────────────────────────────────────

function WalletPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFE135"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
      <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
      <p className="max-w-md text-center text-[#7DD3E8]">
        Connect your wallet to see your Pizza Boxes, Rare Pizzas, and toppings.
      </p>
      <ConnectButton />
    </div>
  );
}

// ─── Share Button ───────────────────────────────────────────────────

function ShareButton({ address }: { address: `0x${string}` }) {
  const { favorites } = useFavorites();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const stars = encodeStars(favorites);
    const url = `${origin}/collection/${address}${
      stars ? `?stars=${stars}` : ""
    }`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for browsers/contexts without the async clipboard API.
        window.prompt("Copy your collection link:", url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last-resort fallback if clipboard write rejects (e.g. permissions).
      window.prompt("Copy your collection link:", url);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-full bg-[#FFE135] px-4 py-2 text-sm font-bold text-black transition-transform hover:scale-105"
      aria-label="Copy a shareable link to your collection"
    >
      {copied ? (
        <>
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Link copied!
        </>
      ) : (
        <>
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
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function MyCollectionPage() {
  const { address, isConnected } = useAccount();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [sendTarget, setSendTarget] = useState<SendTarget | null>(null);
  // Bump to remount the ownership sections after a successful transfer so the
  // sent NFT disappears (wagmi read hooks re-run on mount).
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">My Collection</h1>
          <p className="text-[#7DD3E8]">
            Your Pizza Boxes, Rare Pizzas, and toppings in one place.
          </p>
        </div>
        {isConnected && address && <ShareButton address={address} />}
      </div>

      {!isConnected || !address ? (
        <WalletPrompt />
      ) : (
        <div key={refreshKey}>
          <CollectionView
            address={address}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onSend={setSendTarget}
          />
        </div>
      )}

      {sendTarget && (
        <SendModal
          target={sendTarget}
          onClose={() => setSendTarget(null)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
