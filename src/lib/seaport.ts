import { Seaport } from "@opensea/seaport-js";
import { BrowserProvider } from "ethers";
import type { OrderWithCounter } from "@opensea/seaport-js/lib/types";

// Re-export for consumers
export type { OrderWithCounter };

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
 * The order's consideration items already include marketplace fee + creator royalty
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
