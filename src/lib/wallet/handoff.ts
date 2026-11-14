/**
 * Wallet hand-off helpers ("wallet connect without WalletConnect").
 * Pure functions, no React. Copied from PizzaDAO/rsv-pizza (branch wallets-no-walletconnect),
 * minus the login hand-off: this site has no login, so the plain page URL is all we pass on.
 */

export interface WalletBrowseLink {
  id: "metamask" | "coinbase" | "trust" | "rainbow" | "phantom";
  name: string;
  /** Universal link (https). */
  href: string;
  /** Custom-scheme fallback for when the universal link is intercepted. */
  fallbackHref?: string;
}

type EthWindow = { ethereum?: unknown; phantom?: { ethereum?: unknown } };

/** True on phones and tablets (iPadOS reports a desktop Mac UA, so also check touch). */
export function isMobile(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
  maxTouchPoints: number = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0,
): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

/** Sync check for an injected provider (`window.ethereum`, or a Phantom EVM provider). */
export function hasInjectedProvider(
  win: EthWindow | undefined = typeof window !== "undefined" ? (window as unknown as EthWindow) : undefined,
): boolean {
  if (!win) return false;
  return !!(win.ethereum || win.phantom?.ethereum);
}

const enc = encodeURIComponent;

/**
 * Deep links that open `url` inside each wallet's in-app browser.
 * `url` must be an absolute https URL (use window.location).
 */
export function walletBrowseLinks(url: string): WalletBrowseLink[] {
  const u = new URL(url);
  // MetaMask wants host+path+query with no scheme, appended after /dapp/.
  const noScheme = `${u.host}${u.pathname}${u.search}${u.hash}`;
  return [
    { id: "metamask", name: "MetaMask", href: `https://link.metamask.io/dapp/${noScheme}` },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      href: `https://go.cb-w.com/dapp?cb_url=${enc(url)}`,
      fallbackHref: `cbwallet://dapp?url=${enc(url)}`,
    },
    {
      id: "trust",
      name: "Trust Wallet",
      // coin_id=60 (Ethereum) is required for the injected EVM provider.
      href: `https://link.trustwallet.com/open_url?coin_id=60&url=${enc(url)}`,
    },
    {
      id: "rainbow",
      name: "Rainbow",
      href: `https://rnbwapp.com/dapp?url=${enc(url)}`,
      fallbackHref: `rainbow://dapp?url=${enc(url)}`,
    },
    {
      id: "phantom",
      name: "Phantom",
      href: `https://phantom.com/ul/browse/${enc(url)}?ref=${enc(u.origin)}`,
    },
  ];
}
