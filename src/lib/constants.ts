export const RARE_PIZZAS_CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0" as const;

export const OPENSEA_BASE_URL = `https://opensea.io/assets/ethereum/${RARE_PIZZAS_CONTRACT}`;

export const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1xN149zkgSXPfJhDwQrIzlMzcU9gB--ihdoO_XJXCqf0/edit?gid=0#gid=0";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function getImageUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

export const WOOD_TILE_COUNT = 24;

export function getWoodTileUrl(index: number): string {
  const tile = ((index % WOOD_TILE_COUNT) + WOOD_TILE_COUNT) % WOOD_TILE_COUNT;
  return getImageUrl(`/wood/tile-${tile}.webp`);
}

export const ERC721_ENUMERABLE_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const EXCLUDED_TRAIT_TYPES = new Set([
  "Pizza Recipe",
  "Box",
  "Paper",
]);

export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export const RARITY_COLORS: Record<string, string> = {
  common: "#9CA3AF",
  uncommon: "#22C55E",
  rare: "#3B82F6",
  superrare: "#A855F7",
  epic: "#F97316",
  grail: "#EAB308",
};
