"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { RARE_PIZZAS_CONTRACT, ERC721_ENUMERABLE_ABI } from "@/lib/constants";
import { PIZZA_BOX_CONTRACT, BOX_ABI } from "@/lib/contracts";

export default function WalletStatus() {
  const { address, isConnected } = useAccount();
  const pathname = usePathname();
  const active = pathname.startsWith("/my-toppings");

  const { data: pizzaBalance } = useReadContract({
    address: RARE_PIZZAS_CONTRACT,
    abi: ERC721_ENUMERABLE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const { data: boxBalance } = useReadContract({
    address: PIZZA_BOX_CONTRACT,
    abi: BOX_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const pizzas = pizzaBalance ? Number(pizzaBalance) : 0;
  const boxes = boxBalance ? Number(boxBalance) : 0;

  if (!isConnected || (pizzas === 0 && boxes === 0)) {
    return null;
  }

  const parts: string[] = [];
  if (pizzas > 0) parts.push(`${pizzas} Rare Pizza${pizzas !== 1 ? "s" : ""}`);
  if (boxes > 0) parts.push(`${boxes} Box${boxes !== 1 ? "es" : ""}`);

  return (
    <Link href="/my-toppings">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          active
            ? "bg-[#FFE135]/20 text-[#FFE135] hover:bg-[#FFE135]/30"
            : "bg-[#7DD3E8]/20 text-[#7DD3E8] hover:bg-[#7DD3E8]/30"
        }`}
      >
        &#127829; {parts.join(", ")}
      </span>
    </Link>
  );
}
