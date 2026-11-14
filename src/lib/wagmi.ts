import { mainnet, optimism } from "wagmi/chains";
import { createConfig, http } from "wagmi";
import { createWalletConnectors } from "@/lib/wallet/connectors";

// No WalletConnect / Reown project ID: see lib/wallet/connectors.ts.
export const config = createConfig({
  chains: [mainnet, optimism],
  connectors: createWalletConnectors({
    name: "Rare Pizzas",
    url: "https://rarepizzas.com",
    icon: "https://rarepizzas.com/pizzadao-icon.svg",
  }),
  transports: {
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com", {
      batch: false,
    }),
    [optimism.id]: http("https://optimism-rpc.publicnode.com", {
      batch: false,
    }),
  },
  ssr: true,
});
