import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";
import { http } from "wagmi";

export const config = getDefaultConfig({
  appName: "Rare Pizzas",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "placeholder",
  chains: [mainnet],
  transports: {
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com", {
      batch: false,
    }),
  },
  ssr: true,
});
