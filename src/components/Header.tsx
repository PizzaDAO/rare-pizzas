"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { SPREADSHEET_URL } from "@/lib/constants";
import WalletStatus from "./WalletStatus";

const ConnectButton = dynamic(
  () =>
    import("@rainbow-me/rainbowkit").then((mod) => mod.ConnectButton),
  { ssr: false }
);

function SpreadsheetIcon() {
  return (
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
      className="inline-block"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export default function Header() {
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 border-b border-[#FFE135]/20 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/pizzadao-logo.svg"
              alt="PizzaDAO"
              width={140}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            <Link
              href="/"
              className="text-sm text-[#7DD3E8] transition-colors hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/browse"
              className="text-sm text-[#7DD3E8] transition-colors hover:text-white"
            >
              Browse All
            </Link>
            <Link
              href="/chefs"
              className="text-sm text-[#7DD3E8] transition-colors hover:text-white"
            >
              Chefs
            </Link>
            <Link
              href="/mint"
              className="text-sm text-[#FFE135] transition-colors hover:text-white"
            >
              Mint
            </Link>
            {isConnected && (
              <Link
                href="/my-toppings"
                className="text-sm text-[#FFE135] transition-colors hover:text-white"
              >
                My Toppings
              </Link>
            )}
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-[#7DD3E8] transition-colors hover:text-white"
              title="View Spreadsheet"
            >
              <SpreadsheetIcon />
              <span className="hidden md:inline">Spreadsheet</span>
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <WalletStatus />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
