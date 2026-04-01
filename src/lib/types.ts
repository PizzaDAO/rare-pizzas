export type Rarity = "common" | "uncommon" | "rare" | "superrare" | "epic" | "grail";

export interface Topping {
  sku: number;
  class: string;
  name: string;
  description: string;
  artist: string;
  artistTwitter?: string;
  artistDiscord?: string;
  artistIG?: string;
  artistBio?: string;
  artistBioGenerated?: boolean;
  rarity: Rarity;
  probability: number;
  image: string;
  variants: string[];
  altArt?: { image: string; artist: string; label: string }[];
  nutrition: Record<string, number | undefined>;
}

export interface ToppingClass {
  name: string;
  slug: string;
  count: number;
  sampleImages: string[];
}

export interface OwnedTopping {
  topping: Topping;
  count: number;
  tokenIds: number[];
}

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: NFTAttribute[];
}

export interface PizzaTokenData {
  tokenId: number;
  metadata: NFTMetadata | null;
  toppings: Topping[];
  unmatchedTraits: NFTAttribute[];
}

export interface OwnerLookupResult {
  ownerAddress: string | null;
  twitter: string | null;
  username: string | null;
}
