"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEnsAddress, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { normalize } from "viem/ens";
import CollectionView from "@/components/collection/CollectionView";
import { decodeStars } from "@/lib/share";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <span role="img" aria-label="pizza" className="text-6xl">
        🍕
      </span>
      <h2 className="text-2xl font-bold text-white">Collection not found</h2>
      <p className="max-w-md text-[#7DD3E8]">{message}</p>
      <Link
        href="/"
        className="rounded-full bg-[#FFE135] px-5 py-2 text-sm font-bold text-black transition-transform hover:scale-105"
      >
        Back to home
      </Link>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#111] p-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFE135] border-t-transparent" />
      <p className="text-sm text-[#7DD3E8]">{label}</p>
    </div>
  );
}

export default function PublicCollectionPage() {
  const params = useParams<{ address: string }>();
  const searchParams = useSearchParams();

  const raw = decodeURIComponent(
    Array.isArray(params.address) ? params.address[0] : params.address ?? ""
  );

  const isRawAddress = ADDRESS_RE.test(raw);

  // Normalize ENS name for resolution; guard against malformed input.
  const normalizedName = useMemo(() => {
    if (isRawAddress || !raw) return undefined;
    try {
      return normalize(raw);
    } catch {
      return undefined;
    }
  }, [raw, isRawAddress]);

  // Resolve ENS name -> address (mainnet only).
  const {
    data: ensResolvedAddress,
    isLoading: isResolvingEns,
  } = useEnsAddress({
    name: normalizedName,
    chainId: mainnet.id,
    query: { enabled: !!normalizedName },
  });

  const resolvedAddress = isRawAddress
    ? (raw as `0x${string}`)
    : (ensResolvedAddress ?? undefined);

  // Reverse-resolve a nicer display name when given a raw address.
  const { data: reverseEnsName } = useEnsName({
    address: isRawAddress ? (raw as `0x${string}`) : undefined,
    chainId: mainnet.id,
    query: { enabled: isRawAddress },
  });

  // Decode owner's starred items from the `?stars=` param (read-only).
  const starredKeys = useMemo(
    () => decodeStars(searchParams.get("stars")),
    [searchParams]
  );
  const isFavorite = useMemo(
    () => (key: string) => starredKeys.has(key),
    [starredKeys]
  );

  // ── Render states ──────────────────────────────────────────────────

  // Malformed input: not an address and not a normalizable ENS name.
  if (!isRawAddress && !normalizedName) {
    return (
      <NotFound message={`"${raw}" is not a valid wallet address or ENS name.`} />
    );
  }

  // ENS still resolving.
  if (!isRawAddress && isResolvingEns) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-white">Collection</h1>
        </div>
        <Spinner label={`Resolving ${raw}…`} />
      </div>
    );
  }

  // ENS resolved to nothing.
  if (!resolvedAddress) {
    return (
      <NotFound
        message={`We couldn't resolve "${raw}" to a wallet address on Ethereum mainnet.`}
      />
    );
  }

  const displayName = isRawAddress
    ? reverseEnsName ?? truncateAddress(resolvedAddress)
    : raw;

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">
          {displayName}&rsquo;s Collection
        </h1>
        <p className="text-[#7DD3E8]">
          Pizza Boxes, Rare Pizzas, and toppings owned by this wallet.
        </p>
      </div>

      <CollectionView address={resolvedAddress} isFavorite={isFavorite} />
    </div>
  );
}
