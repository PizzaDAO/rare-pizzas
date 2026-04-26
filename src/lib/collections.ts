export interface Collection {
  readonly slug: string;
  readonly name: string;
  readonly contract: string;
  readonly chainId: number;
  readonly standard: "ERC721" | "ERC1155";
  readonly opensea: string;
}

export const COLLECTIONS = [
  {
    slug: "rare-pizzas-box",
    name: "Rare Pizzas Box",
    contract: "0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7",
    chainId: 1,
    standard: "ERC721",
    opensea: "https://opensea.io/collection/rare-pizzas-box",
  },
  {
    slug: "rare-pizzas",
    name: "Rare Pizzas",
    contract: "0xe6616436ff001fe827e37c7fad100f531d0935f0",
    chainId: 1,
    standard: "ERC721",
    opensea: "https://opensea.io/collection/rare-pizzas",
  },
  {
    slug: "pizza-sticks",
    name: "Pizza Sticks & Sauce",
    contract: "0x0c7fca14b968476c223db3ee0fda9da62e0e9106",
    chainId: 10,
    standard: "ERC1155",
    opensea: "https://opensea.io/collection/neo-bambinos-pizza-sticks-and-sauce",
  },
] as const satisfies readonly Collection[];

export function getCollectionBySlug(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

export function getCollectionByContract(contract: string): Collection | undefined {
  return COLLECTIONS.find(
    (c) => c.contract.toLowerCase() === contract.toLowerCase()
  );
}

export const CHAIN_LABELS: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
};

export const CHAIN_CURRENCIES: Record<number, string> = {
  1: "ETH",
  10: "ETH",
};
