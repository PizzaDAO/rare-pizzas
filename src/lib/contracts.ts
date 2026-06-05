export const PIZZA_BOX_CONTRACT = "0x4ae57798AEF4aF99eD03818f83d2d8AcA89952c7" as const;
export const RARE_PIZZAS_CONTRACT = "0xe6616436ff001fe827e37c7fad100f531d0935f0" as const;
export const PIZZA_STICKS_CONTRACT = "0x0c7fca14b968476c223db3ee0fda9da62e0e9106" as const;

export const RECIPES = [
  {
    id: 0,
    name: "Rare",
    description:
      "The wildcard. Draws from the entire pantry — every crust, every sauce, and every possible ingredient. Anything can land here: meats, seafood, bugs, NFTs, space junk. Maximum entropy; the truest random pie.",
  },
  {
    id: 1,
    name: "Old School",
    description:
      "The purist. A tight pantry: just thin/thick/gluten-free crusts and tomato, pesto, or no sauce. Leans on cheeses, classic veggies, peppers, and mushrooms — the toppings nonna would recognize.",
  },
  {
    id: 2,
    name: "New School",
    description:
      "Modern fusion. Ingredients balanced across veggies, meats, fruit, and seafood, with bbq/nutella/squid-ink sauces and keto-crustless options. Eclectic, contemporary, unexpected-combo energy.",
  },
  {
    id: 3,
    name: "Veggie",
    description:
      "Garden-forward, meat-free. Heaviest on vegetables and fruit, plus cheeses, peppers, fungi, herbs, edible flowers, and nuts. Zero meat or seafood; classic sauces only. Fresh and herbaceous.",
  },
  {
    id: 4,
    name: "Meat Lovers",
    description:
      "Carnivore's dream. Every meat in the pantry — pepperoni and bacon through duck, dragon, and unicorn — plus cheeses and, if the chef's not paying attention, a side of bugs.",
  },
  {
    id: 5,
    name: "Seafood Delight",
    description:
      "From the deep. Every seafood topping — shrimp, lobster, octopus, sushi, mermaids, even Cthulhu — over castle/thin/thick crusts with squid-ink or white sauce. Briny and oceanic.",
  },
  {
    id: 6,
    name: "Sweet",
    description:
      "The dessert pie. Fruit-forward and loaded with sweets — ice cream, cotton candy, donuts, marshmallow — on nutella, deep-space, or prismic-fluid sauce and moon/playdao crusts. Sugary and playful.",
  },
  {
    id: 7,
    name: "Horror",
    description:
      "The cursed pie. Built from unsettling meats (eyeball, finger, brain, zombie), bugs (maggots, roaches, spiders), and oddities, on dark crusts with squid-ink, bbq, and deep-space sauce. Macabre and Halloween-coded.",
  },
  {
    id: 8,
    name: "Moon",
    description:
      "The cosmic pie. Space above all — astronauts, UFOs, satellites, black holes, meteorites — plus NFTs and weird misc, on moon/playdao crusts with deep-space/prismic-fluid sauce. Almost no traditional toppings; pure crypto-space surrealism.",
  },
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
