import { createPublicClient, http } from "viem";
import { mainnet, optimism } from "viem/chains";

// Use a minimal interface that covers the methods we actually call (multicall).
// We avoid the full PublicClient generic because mainnet and optimism produce
// incompatible transaction-type unions that cannot be stored in the same Map.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clients = new Map<number, any>();

/**
 * Get a server-side viem public client for the given chain.
 * Uses same public RPCs as the wagmi config.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublicClient(chainId: number): any {
  const existing = clients.get(chainId);
  if (existing) return existing;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;

  switch (chainId) {
    case 1:
      client = createPublicClient({
        chain: mainnet,
        transport: http("https://ethereum-rpc.publicnode.com"),
      });
      break;
    case 10:
      client = createPublicClient({
        chain: optimism,
        transport: http("https://optimism-rpc.publicnode.com"),
      });
      break;
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }

  clients.set(chainId, client);
  return client;
}
