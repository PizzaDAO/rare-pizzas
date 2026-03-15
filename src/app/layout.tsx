import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const naiche = localFont({
  src: "../../public/fonts/Naiche-ExtraBlack.otf",
  variable: "--font-naiche",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rare Pizzas Toppings",
  description:
    "Browse the complete collection of Rare Pizzas toppings — unique digital art assets across multiple classes and rarities.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍕</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${naiche.variable} bg-black font-sans text-[#ededed] antialiased`}
      >
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
          <footer className="border-t border-white/10 py-8 text-center">
            <a
              href="https://pizzadao.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block opacity-50 transition-opacity hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pizzadao-logo.svg"
                alt="PizzaDAO"
                className="h-8 w-auto"
              />
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
