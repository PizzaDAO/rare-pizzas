"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { getClasses, getRarities } from "@/lib/toppings";

interface FilterBarProps {
  showClassFilter?: boolean;
}

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  superrare: "Super Rare",
  epic: "Epic",
  grail: "Grail",
};

export default function FilterBar({ showClassFilter = false }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentClass = searchParams.get("class") || "";
  const currentRarity = searchParams.get("rarity") || "";
  const currentSearch = searchParams.get("search") || "";

  const classes = getClasses();
  const rarities = getRarities();

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {showClassFilter && (
        <select
          value={currentClass}
          onChange={(e) => updateParams("class", e.target.value)}
          className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.slug} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={currentRarity}
        onChange={(e) => updateParams("rarity", e.target.value)}
        className="rounded-lg border border-[#333] bg-[#111] px-3 pr-10 py-2 text-sm text-[#7DD3E8] outline-none focus:border-[#FFE135]"
      >
        <option value="">All Rarities</option>
        {rarities.map((r) => (
          <option key={r} value={r}>
            {RARITY_LABELS[r] || r}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Search by name..."
        value={currentSearch}
        onChange={(e) => updateParams("search", e.target.value)}
        className="rounded-lg border border-[#333] bg-[#111] px-3 py-2 text-sm text-[#7DD3E8] outline-none placeholder:text-[#555] focus:border-[#FFE135]"
      />
    </div>
  );
}
