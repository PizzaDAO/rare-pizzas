"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isMobile, hasInjectedProvider, walletBrowseLinks } from "../lib/wallet/handoff";

/** Number of distinct EIP-6963 wallets that have announced themselves. */
function useAnnouncedWallets(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const seen = new Set<string>();
    const onAnnounce = (e: Event) => {
      const uuid = (e as CustomEvent).detail?.info?.uuid ?? String(seen.size);
      if (!seen.has(uuid)) {
        seen.add(uuid);
        setCount(seen.size);
      }
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);
  return count;
}

/**
 * "Open this page in your wallet app" panel. Rendered only on a mobile browser with no wallet
 * injected (i.e. not already inside a wallet's in-app browser). The site has no login, so the
 * plain page URL is handed over. Buttons are plain links so the tap navigates synchronously.
 */
export function OpenInWallet({ className = "" }: { className?: string }) {
  const announced = useAnnouncedWallets();
  // false during SSR/hydration, true on the client (avoids a hydration mismatch).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fallbackTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  // Never fire the custom-scheme fallback after the page was hidden/left (the app took over).
  useEffect(() => {
    const clear = () => {
      if (fallbackTimer.current) {
        window.clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") clear();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", clear);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", clear);
    };
  }, []);

  if (!mounted || !isMobile() || hasInjectedProvider() || announced > 0) return null;

  const links = walletBrowseLinks(window.location.href);

  const handleTap = (fallback?: string) => {
    if (!fallback) return;
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(() => {
      fallbackTimer.current = null;
      if (document.visibilityState === "visible") window.location.href = fallback;
    }, 1500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={`rounded-xl border border-white/15 bg-white/5 p-3 text-sm ${className}`} data-testid="open-in-wallet">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left text-xs text-white/70"
      >
        Open this page in your wallet app
      </button>
      {open && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.id}
                href={l.href}
                onClick={() => handleTap(l.fallbackHref)}
                className="flex min-h-[40px] items-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white"
              >
                {l.name}
              </a>
            ))}
          </div>
          <button type="button" onClick={handleCopy} className="mt-2 text-xs text-white/60 hover:text-white">
            {copied ? "Link copied" : "Copy link to open in your wallet browser"}
          </button>
        </>
      )}
    </div>
  );
}
