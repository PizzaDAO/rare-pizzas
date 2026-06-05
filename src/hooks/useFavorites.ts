"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

/**
 * Per-wallet favorites persisted in localStorage. Favorite keys are opaque
 * strings (e.g. `rare-pizzas-box:5`) so different collections never collide.
 *
 * SSR-safe: localStorage is only ever read/written inside effects/callbacks,
 * never during render. When no wallet is connected, favorites are empty and
 * toggling is a no-op.
 */
export function useFavorites() {
  const { address } = useAccount();
  const storageKey = address ? `rp-favorites-${address.toLowerCase()}` : null;
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites whenever the connected wallet (storageKey) changes.
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      setFavorites(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setFavorites(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setFavorites(new Set());
    }
  }, [storageKey]);

  const toggleFavorite = useCallback(
    (key: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        if (storageKey && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify([...next]));
          } catch {}
        }
        return next;
      });
    },
    [storageKey]
  );

  const isFavorite = useCallback(
    (key: string): boolean => favorites.has(key),
    [favorites]
  );

  return { favorites, isFavorite, toggleFavorite };
}
