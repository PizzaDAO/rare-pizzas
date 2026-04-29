import { Seaport } from "@opensea/seaport-js";
import { BrowserProvider, Contract } from "ethers";
import { ItemType } from "@opensea/seaport-js/lib/constants";
import type { OrderWithCounter, CreateOrderInput } from "@opensea/seaport-js/lib/types";

// Re-export for consumers
export type { OrderWithCounter };
export { ItemType };

/**
 * Seaport 1.6 contract address — same on all chains.
 * The seaport-js SDK v4 defaults to 1.6 when no override is provided.
 *
 * Note: 0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC is actually the 1.5 address
 * per seaport-js constants. The true 1.6 address is 0x0000000000000068F116a894984e2DB1123eB395.
 * We use the SDK default (1.6) unless the order was created against 1.5.
 */
export const SEAPORT_1_5_ADDRESS =
  "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" as const;
export const SEAPORT_1_6_ADDRESS =
  "0x0000000000000068F116a894984e2DB1123eB395" as const;

/**
 * Seaport conduit address (OpenSea's) — used for approval checks.
 */
export const SEAPORT_CONDUIT_ADDRESS =
  "0x1E0049783F008A0085193E00003D00cd54003c71" as const;

/**
 * WETH contract addresses per chain (offers use WETH, not native ETH).
 */
export const WETH_ADDRESSES: Record<number, string> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",    // Ethereum mainnet
  10: "0x4200000000000000000000000000000000000006",       // Optimism
};

/**
 * Convert a wagmi/EIP-1193 provider into an ethers v6 BrowserProvider + Signer.
 * wagmi's `useConnectorClient` returns a viem WalletClient that exposes
 * `transport`, which can provide the underlying EIP-1193 provider.
 */
async function getEthersSigner(
  walletProvider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  },
  chainId?: number
) {
  const provider = new BrowserProvider(walletProvider, chainId);
  return provider.getSigner();
}

/**
 * Create a Seaport instance from a wagmi wallet provider.
 *
 * @param walletProvider - The EIP-1193 provider from the connected wallet
 * @param chainId - The chain ID the wallet is connected to (1 = Ethereum, 10 = Optimism)
 * @param seaportVersion - Which Seaport version to use. Defaults to "1.6".
 *                         Pass "1.5" if the order was created against 1.5.
 */
export async function createSeaportClient(
  walletProvider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  },
  chainId?: number,
  seaportVersion: "1.5" | "1.6" = "1.6"
): Promise<Seaport> {
  const signer = await getEthersSigner(walletProvider, chainId);

  const overrides: { contractAddress?: string; seaportVersion?: string } = {};
  if (seaportVersion === "1.5") {
    overrides.contractAddress = SEAPORT_1_5_ADDRESS;
    overrides.seaportVersion = "1.5";
  }
  // 1.6 is the SDK default, no override needed

  // Cast to `any` to avoid ESM/CJS ethers type mismatch between
  // our app's ethers (ESM) and seaport-js's ethers (CJS).
  // At runtime the types are identical.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Seaport(signer as any, {
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  });
}

/**
 * Fulfill a Seaport order (Buy Now).
 *
 * The order's consideration items include seller proceeds + marketplace fee + creator royalty (fees deducted from listed price)
 * (baked in at listing time). The buyer just sends the total ETH value.
 *
 * @param seaport - Seaport client instance
 * @param order - The full signed order (OrderWithCounter) from our DB
 * @param accountAddress - The buyer's address
 * @returns The transaction hash
 */
export async function fulfillSeaportOrder(
  seaport: Seaport,
  order: OrderWithCounter,
  accountAddress: string
): Promise<string> {
  const { executeAllActions } = await seaport.fulfillOrder({
    order,
    accountAddress,
  });

  const tx = await executeAllActions();
  // The seaport-js types declare ContractTransaction (the request type) but
  // executeAllActions() actually returns a ContractTransactionResponse at runtime
  // which has `.hash`. Access it via index signature to satisfy both TS and runtime.
  const txHash = (tx as unknown as { hash: string }).hash;
  return txHash;
}

/**
 * Block explorer URL for a transaction on a given chain.
 */
export function getExplorerTxUrl(
  txHash: string,
  chainId: number
): string {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${txHash}`;
    case 10:
      return `https://optimistic.etherscan.io/tx/${txHash}`;
    default:
      return `https://etherscan.io/tx/${txHash}`;
  }
}

/**
 * Block explorer name for a given chain.
 */
export function getExplorerName(chainId: number): string {
  switch (chainId) {
    case 1:
      return "Etherscan";
    case 10:
      return "Optimism Explorer";
    default:
      return "Etherscan";
  }
}

// ─── Phase 3: Listing & Offer Helpers ────────────────────────────────

export interface CreateListingParams {
  /** The NFT contract address */
  tokenContract: string;
  /** The token ID */
  tokenId: string;
  /** ERC721 or ERC1155 */
  tokenStandard: "ERC721" | "ERC1155";
  /** Seller proceeds in wei (listed price minus fees) */
  priceWei: string;
  /** Marketplace fee in wei */
  marketplaceFeeWei: string;
  /** Creator royalty in wei */
  creatorRoyaltyWei: string;
  /** Fee recipient address (resolved from ENS) */
  feeRecipient: string;
  /** Listing expiration as Unix timestamp (seconds) */
  expirationTimestamp: number;
  /** Seller's address */
  sellerAddress: string;
  /** For ERC1155: quantity to list. Defaults to 1. */
  quantity?: number;
}

/**
 * Build and sign a Seaport listing order (seller offers NFT, wants ETH).
 * This is gasless — only an EIP-712 signature.
 *
 * The order structure:
 * - Offer: the NFT (ERC721 or ERC1155 item)
 * - Consideration: seller proceeds (ETH, after fees) + marketplace fee to feeRecipient + creator royalty to feeRecipient
 * - Buyer pays: priceWei + marketplaceFeeWei + creatorRoyaltyWei (= the listed price)
 */
export async function createSeaportListing(
  seaport: Seaport,
  params: CreateListingParams
): Promise<OrderWithCounter> {
  const {
    tokenContract,
    tokenId,
    tokenStandard,
    priceWei,
    marketplaceFeeWei,
    creatorRoyaltyWei,
    feeRecipient,
    expirationTimestamp,
    sellerAddress,
    quantity = 1,
  } = params;

  const itemType = tokenStandard === "ERC1155" ? ItemType.ERC1155 : ItemType.ERC721;

  const orderInput: CreateOrderInput = {
    offer: [
      {
        itemType,
        token: tokenContract,
        identifier: tokenId,
        amount: String(quantity),
      },
    ],
    consideration: [
      {
        // Seller receives proceeds (listed price minus fees)
        amount: priceWei,
        recipient: sellerAddress,
      },
      {
        // Marketplace fee
        amount: marketplaceFeeWei,
        recipient: feeRecipient,
      },
      {
        // Creator royalty
        amount: creatorRoyaltyWei,
        recipient: feeRecipient,
      },
    ],
    endTime: String(expirationTimestamp),
  };

  const { executeAllActions } = await seaport.createOrder(orderInput, sellerAddress);
  const order = await executeAllActions();
  return order;
}

export interface CreateOfferParams {
  /** The NFT contract address */
  tokenContract: string;
  /** The token ID (null for collection-wide offers) */
  tokenId: string | null;
  /** ERC721 or ERC1155 */
  tokenStandard: "ERC721" | "ERC1155";
  /** Chain ID for WETH address lookup */
  chainId: number;
  /** Total WETH offer amount in wei (includes fees) */
  offerAmountWei: string;
  /** Marketplace fee in wei (subtracted from offer to NFT owner) */
  marketplaceFeeWei: string;
  /** Creator royalty in wei (subtracted from offer to NFT owner) */
  creatorRoyaltyWei: string;
  /** Fee recipient address */
  feeRecipient: string;
  /** NFT owner to receive the NFT from (for specific offers) — left blank for collection offers */
  nftRecipient?: string;
  /** Offer expiration as Unix timestamp (seconds) */
  expirationTimestamp: number;
  /** Offerer's address */
  offererAddress: string;
  /** For ERC1155: quantity. Defaults to 1. */
  quantity?: number;
}

/**
 * Build and sign a Seaport offer order (buyer offers WETH, wants NFT).
 *
 * Offers use WETH (ERC20) because Seaport needs an ERC20 on the offer side.
 *
 * The order structure:
 * - Offer: WETH amount
 * - Consideration: the NFT + marketplace fee (WETH) + creator royalty (WETH)
 */
export async function createSeaportOffer(
  seaport: Seaport,
  params: CreateOfferParams
): Promise<OrderWithCounter> {
  const {
    tokenContract,
    tokenId,
    tokenStandard,
    chainId,
    offerAmountWei,
    marketplaceFeeWei,
    creatorRoyaltyWei,
    feeRecipient,
    expirationTimestamp,
    offererAddress,
    quantity = 1,
  } = params;

  const wethAddress = WETH_ADDRESSES[chainId];
  if (!wethAddress) {
    throw new Error(`No WETH address configured for chain ${chainId}`);
  }

  const nftItemType = tokenStandard === "ERC1155" ? ItemType.ERC1155 : ItemType.ERC721;

  // The seaport-js CreateOrderInput has strict discriminated union types.
  // We cast to `any` to build the mixed-type offer/consideration arrays.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderInput: any = {
    offer: [
      {
        itemType: ItemType.ERC20,
        token: wethAddress,
        amount: offerAmountWei,
      },
    ],
    consideration: [
      {
        itemType: nftItemType,
        token: tokenContract,
        identifier: tokenId || "0",
        amount: String(quantity),
        recipient: offererAddress,
      },
      {
        itemType: ItemType.ERC20,
        token: wethAddress,
        amount: marketplaceFeeWei,
        recipient: feeRecipient,
      },
      {
        itemType: ItemType.ERC20,
        token: wethAddress,
        amount: creatorRoyaltyWei,
        recipient: feeRecipient,
      },
    ],
    endTime: String(expirationTimestamp),
  };

  const { executeAllActions } = await seaport.createOrder(orderInput, offererAddress);
  const order = await executeAllActions();
  return order;
}

/**
 * Cancel a Seaport order on-chain.
 * This costs gas — it calls Seaport's cancel() function.
 *
 * @param seaport - Seaport client instance
 * @param orderComponents - The order parameters to cancel (from order.parameters)
 * @returns The transaction hash
 */
export async function cancelSeaportOrder(
  seaport: Seaport,
  orderComponents: OrderWithCounter["parameters"][]
): Promise<string> {
  const tx = await seaport.cancelOrders(orderComponents);
  const receipt = await tx.transact();
  const txHash = (receipt as unknown as { hash: string }).hash;
  return txHash;
}

/**
 * Fulfill a buyer's offer — seller sends NFT, receives WETH.
 *
 * @param seaport - Seaport client instance
 * @param order - The offer order to fulfill
 * @param accountAddress - The seller's address (who fulfills the offer)
 * @returns The transaction hash
 */
export async function fulfillSeaportOffer(
  seaport: Seaport,
  order: OrderWithCounter,
  accountAddress: string
): Promise<string> {
  const { executeAllActions } = await seaport.fulfillOrder({
    order,
    accountAddress,
  });

  const tx = await executeAllActions();
  const txHash = (tx as unknown as { hash: string }).hash;
  return txHash;
}

/**
 * Check if the Seaport conduit is approved for a collection (isApprovedForAll).
 */
export async function checkApproval(
  walletProvider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  },
  chainId: number,
  tokenContract: string,
  ownerAddress: string,
  tokenStandard: "ERC721" | "ERC1155"
): Promise<boolean> {
  const provider = new BrowserProvider(walletProvider, chainId);

  const abi = [
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
  ];
  const contract = new Contract(tokenContract, abi, provider);

  const isApproved = await contract.isApprovedForAll(ownerAddress, SEAPORT_CONDUIT_ADDRESS);
  return isApproved;
}

/**
 * Send a setApprovalForAll transaction for the Seaport conduit.
 * One-time per collection.
 *
 * @returns The transaction hash
 */
export async function approveForSeaport(
  walletProvider: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  },
  chainId: number,
  tokenContract: string
): Promise<string> {
  const provider = new BrowserProvider(walletProvider, chainId);
  const signer = await provider.getSigner();

  const abi = [
    "function setApprovalForAll(address operator, bool approved)",
  ];
  const contract = new Contract(tokenContract, abi, signer);

  const tx = await contract.setApprovalForAll(SEAPORT_CONDUIT_ADDRESS, true);
  const receipt = await tx.wait();
  return receipt.hash;
}
