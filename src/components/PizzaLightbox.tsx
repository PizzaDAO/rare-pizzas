"use client";

import { useEffect, useCallback } from "react";
import { OPENSEA_BASE_URL } from "@/lib/constants";

interface PizzaLightboxProps {
  tokenId: number;
  onClose: () => void;
}

export default function PizzaLightbox({ tokenId, onClose }: PizzaLightboxProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    // Prevent body scroll while lightbox is open
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [handleEscape]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-[#333] bg-[#111] shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1 text-[#555] transition-colors hover:text-white"
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

        <div className="p-6">
          {/* Pizza image */}
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/pizzas/${tokenId}.webp`}
              alt={`Rare Pizza #${tokenId}`}
              className="max-h-[60vh] w-full rounded-xl object-contain"
            />
          </div>

          {/* Token heading */}
          <h3 className="mb-3 text-center text-xl font-bold text-white">
            Rare Pizza #{tokenId}
          </h3>

          {/* OpenSea link */}
          <a
            href={`${OPENSEA_BASE_URL}/${tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-[#333] bg-[#0a0a0a] px-4 py-3 text-sm font-medium text-[#7DD3E8] transition-colors hover:border-[#7DD3E8]/50 hover:text-white"
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
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View on OpenSea
          </a>
        </div>
      </div>
    </div>
  );
}
