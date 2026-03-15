import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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
        className={`${rubik.variable} ${naiche.variable} bg-black font-sans text-[#ededed] antialiased`}
      >
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
