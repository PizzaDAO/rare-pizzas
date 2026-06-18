"use client";

import { useState } from "react";
import PizzaLightbox from "@/components/PizzaLightbox";

interface PizzaGridProps {
  pizzaTokenIds: number[];
}

export default function PizzaGrid({ pizzaTokenIds }: PizzaGridProps) {
  const [selectedPizza, setSelectedPizza] = useState<number | null>(null);

  return (
    <section className="mt-12">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[#7DD3E8]">
        Rare Pizzas with this topping
      </h2>
      <p className="mb-4 text-sm text-[#555]">
        Found on {pizzaTokenIds.length} pizza
        {pizzaTokenIds.length !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {pizzaTokenIds.map((tokenId) => (
          <button
            key={tokenId}
            onClick={() => setSelectedPizza(tokenId)}
            className="group overflow-hidden rounded-lg border border-[#333]/50 transition-all hover:border-[#FFE135]/50 hover:shadow-lg hover:shadow-[#FFE135]/10"
            title={`Rare Pizza #${tokenId}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/pizzas/${tokenId}.webp`}
              alt={`Rare Pizza #${tokenId}`}
              width={200}
              height={200}
              className="h-auto w-full transition-transform group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {selectedPizza !== null && (
        <PizzaLightbox
          tokenId={selectedPizza}
          onClose={() => setSelectedPizza(null)}
        />
      )}
    </section>
  );
}
