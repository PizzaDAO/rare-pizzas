"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import FilterBar from "@/components/FilterBar";
import ToppingCard from "@/components/ToppingCard";
import ClassCard from "@/components/ClassCard";
import { getAllToppings, getToppingClasses, getCrustClass } from "@/lib/toppings";

function ToppingsContent() {
  const searchParams = useSearchParams();
  const classFilter = searchParams.get("class") || "";
  const rarityFilter = searchParams.get("rarity") || "";
  const searchFilter = searchParams.get("search") || "";

  const allToppings = getAllToppings();
  const toppingClasses = getToppingClasses();
  const crustClass = getCrustClass();

  const toppingCount = allToppings.filter((t) => t.class !== "Crust").length;
  const crustCount = crustClass?.count ?? 0;

  const hasFilters = classFilter || rarityFilter || searchFilter;

  const filtered = useMemo(() => {
    let result = allToppings;

    if (classFilter) {
      result = result.filter((t) => t.class === classFilter);
    }

    if (rarityFilter) {
      result = result.filter((t) => t.rarity === rarityFilter);
    }

    if (searchFilter) {
      const query = searchFilter.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(query));
    }

    return result;
  }, [allToppings, classFilter, rarityFilter, searchFilter]);

  return (
    <>
      <section className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Rare Pizzas Toppings
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          314 unique artist toppings across 17 classes, 16 NFTs, and 7 crusts.
          Each topping is a hand-crafted piece of digital art created by a
          different artist from around the world.
        </p>
      </section>

      <FilterBar showClassFilter />

      {hasFilters ? (
        <>
          <p className="mb-4 text-sm text-[#7DD3E8]">
            Showing {filtered.length} of {allToppings.length} toppings
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t, i) => (
              <ToppingCard key={t.sku} topping={t} index={i} />
            ))}
          </div>
        </>
      ) : (
        <>
          <section className="mb-12">
            <h2 className="mb-6 text-2xl font-semibold text-white">
              Topping Classes
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {toppingClasses.map((c, i) => (
                <ClassCard key={c.slug} toppingClass={c} index={i} />
              ))}
            </div>
          </section>

          {crustClass && (
            <section>
              <h2 className="mb-6 text-2xl font-semibold text-white">Crusts</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <ClassCard toppingClass={crustClass} index={17} />
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

export default function ToppingsPage() {
  return (
    <div>
      <Suspense>
        <ToppingsContent />
      </Suspense>
    </div>
  );
}
