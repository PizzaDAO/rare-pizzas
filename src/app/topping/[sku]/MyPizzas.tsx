"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { RARE_PIZZAS_CONTRACT, PIZZA_ABI } from "@/lib/contracts";
import { OPENSEA_BASE_URL } from "@/lib/constants";

const PIZZA_ERC721_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function MyPizzas({ pizzaTokenIds }: { pizzaTokenIds: number[] }) {
  const { address, isConnected } = useAccount();

  const { data: balance } = useReadContract({
    address: RARE_PIZZAS_CONTRACT,
    abi: PIZZA_ERC721_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const totalOwned = balance ? Number(balance) : 0;

  const tokenIndexContracts = useMemo(() => {
    if (!address || !totalOwned) return [];
    return Array.from({ length: totalOwned }, (_, i) => ({
      address: RARE_PIZZAS_CONTRACT,
      abi: PIZZA_ERC721_ABI,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)] as const,
    }));
  }, [address, totalOwned]);

  const { data: tokenIdResults } = useReadContracts({
    contracts: tokenIndexContracts,
    query: { enabled: tokenIndexContracts.length > 0 },
  });

  const myPizzaIds = useMemo(() => {
    if (!tokenIdResults) return [];
    return tokenIdResults
      .filter((r) => r.status === "success" && r.result !== undefined)
      .map((r) => Number(r.result as bigint));
  }, [tokenIdResults]);

  const myPizzasWithTopping = useMemo(() => {
    const set = new Set(pizzaTokenIds);
    return myPizzaIds.filter((id) => set.has(id));
  }, [myPizzaIds, pizzaTokenIds]);

  if (!isConnected || myPizzasWithTopping.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#FFE135]">
        My Rare Pizzas with this topping
      </h2>
      <p className="mb-4 text-sm text-[#555]">
        You own {myPizzasWithTopping.length} pizza{myPizzasWithTopping.length !== 1 ? "s" : ""} with this topping
      </p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {myPizzasWithTopping.map((tokenId) => (
          <a
            key={tokenId}
            href={`${OPENSEA_BASE_URL}/${tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-lg border border-[#FFE135]/30 transition-all hover:border-[#FFE135]/50 hover:shadow-lg hover:shadow-[#FFE135]/10"
            title={`Rare Pizza #${tokenId}`}
          >
            <img
              src={`/pizzas/${tokenId}.webp`}
              alt={`Rare Pizza #${tokenId}`}
              width={200}
              height={200}
              className="h-auto w-full transition-transform group-hover:scale-105"
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
