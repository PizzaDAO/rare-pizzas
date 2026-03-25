import { getWoodTileUrl } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Kitchen Chefs | Rare Pizzas",
  description:
    "Meet the chefs behind the Rare Pizzas kitchen — Head Chef Shrimp, Oven Chef Don Volare, Toppings Chefs Cactus, Oscar Frog, Pizza Slyce, Don Fingas, and Peanut Chews, and Sous Chef Jalapeno Peppers.",
};

const chefs = [
  {
    title: "Head Chef",
    name: "Shrimp",
  },
  {
    title: "Oven Chef",
    name: "Don Volare",
  },
  {
    title: "Toppings Chef",
    name: "Cactus",
  },
  {
    title: "Toppings Chef",
    name: "Oscar Frog",
  },
  {
    title: "Toppings Chef",
    name: "Pizza Slyce",
  },
  {
    title: "Toppings Chef",
    name: "Don Fingas",
  },
  {
    title: "Toppings Chef",
    name: "Peanut Chews",
    x: "snack_man",
  },
  {
    title: "Sous Chef",
    name: "Jalapeno Peppers",
  },
];

export default function ChefsPage() {
  return (
    <div>
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          The Kitchen
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[#7DD3E8]">
          Meet the chefs who run the Rare Pizzas kitchen.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {chefs.map((chef, i) => (
          <div
            key={chef.name}
            className="rounded-xl border border-[#333]/50 bg-cover bg-center p-6 text-center"
            style={{ backgroundImage: `url(${getWoodTileUrl(i)})` }}
          >
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[#E85D5D] text-4xl">
              {chef.name[0]}
            </div>
            <p className="text-sm font-medium uppercase tracking-wider text-[#FFE135]">
              {chef.title}
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">{chef.name}</h2>
            {"x" in chef && (
              <a
                href={`https://x.com/${chef.x}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-[#7DD3E8] hover:text-white"
              >
                @{chef.x}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
