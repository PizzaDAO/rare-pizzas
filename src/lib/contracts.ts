export const PIZZA_BOX_CONTRACT = "0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7" as const;
export const RARE_PIZZAS_CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0" as const;
export const PIZZA_STICKS_CONTRACT = "0x0c7fca14b968476c223db3ee0fda9da62e0e9106" as const;

export const RECIPES = [
  { id: 0, name: "Rare" },
  { id: 1, name: "Old School" },
  { id: 2, name: "New School" },
  { id: 3, name: "Veggie" },
  { id: 4, name: "Meat Lovers" },
  { id: 5, name: "Seafood Delight" },
  { id: 6, name: "Sweet" },
  { id: 7, name: "Horror" },
  { id: 8, name: "Moon" },
] as const;

export const BOX_ABI = [
  {
    inputs: [{ name: "n", type: "uint256" }],
    name: "multiPurchase",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "getPrice",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "multiPurchaseLimit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalNewPurchases",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxNewPurchases",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
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
] as const;

export const PIZZA_ABI = [
  {
    inputs: [
      { name: "boxTokenId", type: "uint256" },
      { name: "recipeId", type: "uint256" },
    ],
    name: "redeemRarePizzasBox",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "boxTokenId", type: "uint256" }],
    name: "isRedeemed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
