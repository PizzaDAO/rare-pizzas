"use client";

interface ActivityEvent {
  id: string;
  eventType: string;
  collection: string;
  tokenContract: string;
  chainId: number;
  tokenId: string;
  fromAddress: string | null;
  toAddress: string | null;
  fromEns: string | null;
  toEns: string | null;
  priceWei: string | null;
  currency: string | null;
  nftName: string | null;
  imageUrl: string | null;
  txHash: string | null;
  happenedAt: string;
}

export type { ActivityEvent };

const BADGE_COLORS: Record<string, string> = {
  mint: "bg-green-500/20 text-green-400",
  sale: "bg-[#FFE135]/20 text-[#FFE135]",
  transfer: "bg-[#7DD3E8]/20 text-[#7DD3E8]",
  listing: "bg-purple-500/20 text-purple-400",
  offer: "bg-orange-500/20 text-orange-400",
  cancel: "bg-red-500/20 text-red-400",
};

const COLLECTION_LABELS: Record<string, string> = {
  "rare-pizzas-box": "Box",
  "rare-pizzas": "Pizza",
  "neo-bambinos-pizza-sticks-and-sauce": "Sticks",
};

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatPrice(wei: string): string {
  const eth = Number(wei) / 1e18;
  if (eth < 0.001) return "<0.001";
  return eth.toFixed(eth < 1 ? 4 : 3);
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

function etherscanUrl(chainId: number, txHash: string): string {
  if (chainId === 10) return `https://optimistic.etherscan.io/tx/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}

export default function ActivityEventRow({ event }: { event: ActivityEvent }) {
  const badgeClass = BADGE_COLORS[event.eventType] || BADGE_COLORS.transfer;
  const collectionLabel =
    COLLECTION_LABELS[event.collection] || event.collection;
  const fromDisplay =
    event.fromEns ||
    (event.fromAddress ? truncateAddress(event.fromAddress) : "\u2014");
  const toDisplay =
    event.toEns ||
    (event.toAddress ? truncateAddress(event.toAddress) : "\u2014");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#222] bg-[#111] p-3 transition-colors hover:border-[#333] sm:gap-4 sm:p-4">
      {/* NFT Thumbnail */}
      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-[#222]">
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt={event.nftName || "NFT"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[#555]">
            NFT
          </div>
        )}
      </div>

      {/* Event info */}
      <div className="min-w-0 flex-1">
        {/* Top row: badge + name + collection */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeClass}`}
          >
            {event.eventType}
          </span>
          <span className="truncate text-sm font-medium text-white">
            {event.nftName || `#${event.tokenId}`}
          </span>
          <span className="rounded bg-[#222] px-1.5 py-0.5 text-xs text-[#7DD3E8]">
            {collectionLabel}
          </span>
        </div>

        {/* Bottom row: from -> to + price */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#888]">
          {(event.eventType === "mint" ||
            event.eventType === "sale" ||
            event.eventType === "transfer") && (
            <span>
              {event.eventType === "mint" ? "Minted by " : `${fromDisplay} \u2192 `}
              <span className="text-[#aaa]">
                {event.eventType === "mint" ? toDisplay : toDisplay}
              </span>
            </span>
          )}
          {event.eventType === "listing" && (
            <span>
              Listed by <span className="text-[#aaa]">{fromDisplay}</span>
            </span>
          )}
          {event.eventType === "offer" && (
            <span>
              Offer by <span className="text-[#aaa]">{fromDisplay}</span>
            </span>
          )}
          {event.priceWei && (
            <span className="font-medium text-[#FFE135]">
              {formatPrice(event.priceWei)} {event.currency || "ETH"}
            </span>
          )}
        </div>
      </div>

      {/* Right side: time + etherscan */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-[#555]">
          {relativeTime(event.happenedAt)}
        </span>
        {event.txHash && (
          <a
            href={etherscanUrl(event.chainId, event.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#7DD3E8] hover:text-white"
          >
            View tx
          </a>
        )}
      </div>
    </div>
  );
}
