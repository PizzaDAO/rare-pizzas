"use client";

interface EventTypeToggleProps {
  activeTypes: string[];
  onChange: (types: string[]) => void;
}

const EVENT_TYPE_OPTIONS = [
  { value: "mint", label: "Mints" },
  { value: "sale", label: "Sales" },
  { value: "transfer", label: "Transfers" },
  { value: "listing", label: "Listings" },
  { value: "offer", label: "Offers" },
];

export default function EventTypeToggle({
  activeTypes,
  onChange,
}: EventTypeToggleProps) {
  function toggle(value: string) {
    if (activeTypes.includes(value)) {
      // Don't allow deselecting all
      if (activeTypes.length === 1) return;
      onChange(activeTypes.filter((t) => t !== value));
    } else {
      onChange([...activeTypes, value]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {EVENT_TYPE_OPTIONS.map((opt) => {
        const active = activeTypes.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[#FFE135] text-black"
                : "border border-[#333] text-[#7DD3E8] hover:border-[#FFE135]/50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
