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
              className="text-sm text-[#FFE135] transition-colors hover:text-white"
            >
              Mint
            </Link>
            <Link
              href="/toppings"
              className="text-sm text-[#7DD3E8] transition-colors hover:text-white"
            >
              Toppings
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
          <div className="hidden items-center gap-2 sm:flex">
            <a
              href="https://discord.pizzadao.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-white/50 transition-colors hover:text-white"
              title="Discord"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
            </a>
            <a
              href="https://opensea.io/collection/rare-pizzas-box"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-white/50 transition-colors hover:text-white"
              title="OpenSea"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.374 0 12s5.374 12 12 12 12-5.374 12-12S18.629 0 12 0zM5.92 12.403l.051-.081 3.123-4.884a.107.107 0 0 1 .187.014c.52 1.169.972 2.623.76 3.528-.088.372-.328.878-.614 1.345a4.84 4.84 0 0 1-.18.312.11.11 0 0 1-.09.048H6.012a.107.107 0 0 1-.091-.163zm13.914 1.68a.109.109 0 0 1-.065.101c-.243.103-1.07.485-1.414.962-.878 1.222-1.548 2.97-3.048 2.97H9.053a4.019 4.019 0 0 1-4.013-4.028v-.072c0-.058.048-.107.108-.107h3.485c.07 0 .12.063.115.132-.026.226.017.459.125.67.206.42.636.682 1.099.682h1.726v-1.347H9.99a.11.11 0 0 1-.089-.173l.063-.09c.16-.231.391-.586.621-.992.156-.274.308-.566.43-.86.024-.052.043-.107.065-.16.033-.094.067-.182.091-.269a6.04 6.04 0 0 0 .098-.509c.013-.107.02-.218.02-.332a5.15 5.15 0 0 0-.02-.384 5.348 5.348 0 0 0-.048-.384 4.446 4.446 0 0 0-.098-.468l-.014-.06c-.03-.107-.065-.21-.098-.321a13.014 13.014 0 0 0-.328-.9l-.14-.36c-.067-.163-.134-.312-.196-.453-.03-.065-.056-.123-.082-.182a8.946 8.946 0 0 0-.126-.269c-.03-.056-.06-.107-.086-.16l-.243-.427a.073.073 0 0 1 .082-.107l1.32.358h.006l.174.048.192.053.07.02v-.8c0-.37.152-.71.398-.954A1.342 1.342 0 0 1 12.49 6c.37 0 .707.15.953.398.247.244.398.584.398.954v1.188l.142.039a.103.103 0 0 1 .034.02c.04.032.096.082.168.142.056.048.117.103.192.163.15.124.328.283.52.462.048.044.098.09.144.138.254.235.536.51.813.813.077.084.152.17.231.257.076.09.16.178.23.269.094.12.196.24.286.366.04.058.086.12.127.182.12.17.226.35.326.53.04.082.086.17.122.255.107.238.19.482.245.729.017.065.03.134.039.2v.017c.013.065.017.134.022.2a2.348 2.348 0 0 1-.048.684c-.03.12-.065.236-.108.355a4.443 4.443 0 0 1-.345.738c-.043.08-.094.163-.144.24-.056.086-.108.17-.168.249-.082.107-.168.218-.257.321a4.65 4.65 0 0 1-.244.278c-.112.127-.224.244-.34.355-.056.058-.117.12-.178.173-.06.056-.122.107-.178.163-.094.082-.182.152-.262.218l-.17.134a.106.106 0 0 1-.068.024h-1.05v1.347h1.322c.295 0 .576-.104.804-.296.077-.065.56-.486 1.12-1.048a.112.112 0 0 1 .058-.034l3.65-1.055a.108.108 0 0 1 .138.103v.773z" />
              </svg>
            </a>
            <a
              href="https://x.com/rarepizzas"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-white/50 transition-colors hover:text-white"
              title="X (Twitter)"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
          <WalletStatus />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
