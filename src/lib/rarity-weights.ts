import type { Rarity } from "./types";

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 1,
  uncommon: 3,
  rare: 10,
  superrare: 25,
  epic: 75,
  grail: 300,
};

export const TOTAL_UNIQUE_TOPPINGS = 337;
