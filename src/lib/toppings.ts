import toppingsData from "@/data/toppings.json";
import type { Topping, ToppingClass, Rarity, NFTAttribute } from "./types";
import { EXCLUDED_TRAIT_TYPES } from "./constants";

export interface ArtistInfo {
  name: string;
  bio?: string;
  bioGenerated?: boolean;
  twitter?: string;
  instagram?: string;
  discord?: string;
  toppings: Topping[];
  slug: string;
}

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  superrare: 3,
  epic: 4,
  grail: 5,
};

const toppings = (toppingsData as Topping[]).sort(
  (a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99)
);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getAllToppings(): Topping[] {
  return toppings;
}

export function getToppingBySku(sku: number): Topping | undefined {
  return toppings.find((t) => t.sku === sku);
}

export function getToppingsByClass(className: string): Topping[] {
  return toppings.filter((t) => t.class === className);
}

export function getClasses(): ToppingClass[] {
  const classMap = new Map<string, Topping[]>();

  for (const t of toppings) {
    const existing = classMap.get(t.class);
    if (existing) {
      existing.push(t);
    } else {
      classMap.set(t.class, [t]);
    }
  }

  const classes: ToppingClass[] = [];

  for (const [name, items] of classMap) {
    classes.push({
      name,
      slug: slugify(name),
      count: items.length,
      sampleImages: items.slice(0, 4).map((t) => t.image),
    });
  }

  return classes;
}

export function getToppingClasses(): ToppingClass[] {
  return getClasses().filter((c) => c.name !== "Crust");
}

export function getCrustClass(): ToppingClass | undefined {
  return getClasses().find((c) => c.name === "Crust");
}

export function getClassBySlug(slug: string): string | undefined {
  const classes = getClasses();
  const found = classes.find((c) => c.slug === slug);
  return found?.name;
}

export function getRarities(): Rarity[] {
  const seen = new Set<Rarity>();
  for (const t of toppings) {
    seen.add(t.rarity);
  }
  return Array.from(seen);
}

// --- Artist helpers ---

let artistCache: ArtistInfo[] | null = null;

export function getAllArtists(): ArtistInfo[] {
  if (artistCache) return artistCache;

  const artistMap = new Map<string, Topping[]>();
  for (const t of toppings) {
    const existing = artistMap.get(t.artist);
    if (existing) {
      existing.push(t);
    } else {
      artistMap.set(t.artist, [t]);
    }
  }

  const artists: ArtistInfo[] = [];
  for (const [name, items] of artistMap) {
    // Take social info from the first topping that has it
    const withTwitter = items.find((t) => t.artistTwitter);
    const withIG = items.find((t) => t.artistIG);
    const withDiscord = items.find((t) => t.artistDiscord);

    artists.push({
      name,
      bio: items[0].artistBio,
      bioGenerated: items[0].artistBioGenerated,
      twitter: withTwitter?.artistTwitter,
      instagram: withIG?.artistIG,
      discord: withDiscord?.artistDiscord,
      toppings: items,
      slug: slugify(name),
    });
  }

  artists.sort((a, b) => a.name.localeCompare(b.name));
  artistCache = artists;
  return artists;
}

export function getNotableArtists(): ArtistInfo[] {
  return getAllArtists().filter((a) => !a.bioGenerated);
}

export function getArtistBySlug(slug: string): ArtistInfo | undefined {
  return getAllArtists().find((a) => a.slug === slug);
}

// --- Topping lookup for NFT metadata matching ---

type ToppingLookup = Map<string, Topping>;

let lookupCache: ToppingLookup | null = null;

function makeKey(className: string, name: string): string {
  return `${className.toLowerCase().trim()}:${name.toLowerCase().trim()}`;
}

export function buildToppingLookup(): ToppingLookup {
  if (lookupCache) return lookupCache;

  const lookup: ToppingLookup = new Map();

  for (const t of toppings) {
    // Exact normalized key
    lookup.set(makeKey(t.class, t.name), t);
  }

  lookupCache = lookup;
  return lookup;
}

export function matchTopping(
  attribute: NFTAttribute
): Topping | null {
  if (EXCLUDED_TRAIT_TYPES.has(attribute.trait_type)) {
    return null;
  }

  const lookup = buildToppingLookup();
  const className = String(attribute.trait_type);
  const name = String(attribute.value);

  // Tier 1: Exact normalized match
  const exactKey = makeKey(className, name);
  const exact = lookup.get(exactKey);
  if (exact) return exact;

  // Tier 2: Partial / contains match within the same class
  const lowerName = name.toLowerCase().trim();
  for (const t of toppings) {
    if (t.class.toLowerCase() !== className.toLowerCase()) continue;
    const tName = t.name.toLowerCase();
    if (tName.includes(lowerName) || lowerName.includes(tName)) {
      return t;
    }
  }

  return null;
}
