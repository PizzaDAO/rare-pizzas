"use client";

export type SortCategory = "total" | "rarity" | "completeness";

interface CategoryTabsProps {
  active: SortCategory;
  onChange: (cat: SortCategory) => void;
}

const TABS: { value: SortCategory; label: string }[] = [
  { value: "total", label: "Total NFTs" },
  { value: "rarity", label: "Rarity Score" },
  { value: "completeness", label: "Topping Collection" },
];

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.value
              ? "bg-[#FFE135] text-black"
              : "border border-[#333] bg-[#111] text-[#7DD3E8] hover:border-[#FFE135]/50 hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
