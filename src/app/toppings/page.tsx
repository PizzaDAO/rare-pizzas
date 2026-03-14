import { getAllToppings, getToppingClasses, getCrustClass } from "@/lib/toppings";
import ClassCard from "@/components/ClassCard";

export default function Home() {
  const toppings = getAllToppings();
  const toppingClasses = getToppingClasses();
  const crustClass = getCrustClass();

  const toppingCount = toppings.filter((t) => t.class !== "Crust").length;
  const crustCount = crustClass?.count ?? 0;

  return (
    <div>
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Rare Pizzas Toppings
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Browse {toppingCount} unique toppings across {toppingClasses.length}{" "}
          classes{crustCount > 0 && <> + {crustCount} crusts</>}. Each topping
          is a hand-crafted piece of digital art created by a different artist from around
          the world.
        </p>
      </section>

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
    </div>
  );
}
