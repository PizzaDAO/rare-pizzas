"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import WalletStatus from "./WalletStatus";

const ConnectButton = dynamic(
  () =>
    import("@rainbow-me/rainbowkit").then((mod) => mod.ConnectButton),
  { ssr: false }
);

function navColor(href: string, pathname: string, mobile = false) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const base = mobile ? "text-base" : "text-sm";
  return active
    ? `${base} text-[#FFE135] transition-colors hover:text-white`
    : `${base} text-[#7DD3E8] transition-colors hover:text-white`;
}

export default function Header() {
  const { isConnected } = useAccount();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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
            <Link href="/" className={navColor("/", pathname)}>
              Mint
            </Link>
            <Link href="/toppings" className={navColor("/toppings", pathname)}>
              Toppings
            </Link>
            <a
              href="https://globalpizza.party"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#7DD3E8] transition-colors hover:text-white"
            >
              Global Pizza Party
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <a
              href="https://discord.pizzadao.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 opacity-50 transition-opacity hover:opacity-100"
              title="Discord"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/discord.svg" alt="Discord" className="h-5 w-5 invert" />
            </a>
            <a
              href="https://opensea.io/collection/rare-pizzas-box"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 opacity-50 transition-opacity hover:opacity-100"
              title="OpenSea"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/opensea.svg" alt="OpenSea" className="h-8 w-8 invert" />
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
          <ConnectButton showBalance={false} />
          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden rounded-md p-1.5 text-white/70 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="flex flex-col gap-3 border-t border-[#FFE135]/10 px-4 py-4 sm:hidden">
          <Link href="/" className={navColor("/", pathname, true)} onClick={() => setMenuOpen(false)}>
            Mint
          </Link>
          <Link href="/toppings" className={navColor("/toppings", pathname, true)} onClick={() => setMenuOpen(false)}>
            Toppings
          </Link>
          <a
            href="https://globalpizza.party"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base text-[#7DD3E8] transition-colors hover:text-white"
          >
            Global Pizza Party
          </a>
          <div className="flex items-center gap-3 pt-2">
            <a href="https://discord.pizzadao.xyz" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/discord.svg" alt="Discord" className="h-5 w-5 invert" />
            </a>
            <a href="https://opensea.io/collection/rare-pizzas-box" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/opensea.svg" alt="OpenSea" className="h-8 w-8 invert" />
            </a>
            <a href="https://x.com/rarepizzas" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
