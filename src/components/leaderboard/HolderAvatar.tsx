"use client";

/**
 * Shows ENS avatar if available, otherwise a deterministic gradient
 * generated from the wallet address.
 */

interface HolderAvatarProps {
  wallet: string;
  ensAvatar: string | null;
  size?: number;
}

function walletToGradient(wallet: string): string {
  // Use last 12 hex chars for two colors
  const hex = wallet.replace("0x", "").toLowerCase();
  const c1 = `#${hex.slice(0, 6)}`;
  const c2 = `#${hex.slice(6, 12)}`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}

export default function HolderAvatar({
  wallet,
  ensAvatar,
  size = 36,
}: HolderAvatarProps) {
  if (ensAvatar) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={ensAvatar}
        alt="avatar"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full"
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: walletToGradient(wallet),
      }}
    />
  );
}
