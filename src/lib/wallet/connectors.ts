import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import type { Wallet, WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { coinbaseWallet, injectedWallet, metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConnector } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { hasInjectedProvider, isMobile } from "./handoff";

interface AppMeta {
  name: string;
  url: string;
  icon: string;
}

/**
 * MetaMask via the MetaMask SDK only, never WalletConnect. RainbowKit's own metaMaskWallet
 * falls back to WalletConnect on desktop without the extension, which needs a Reown project ID.
 */
function metaMaskSdkWallet(app: AppMeta) {
  return (): Wallet => ({
    // Reuse RainbowKit's MetaMask metadata (icon, store links); only the connector differs.
    ...metaMaskWallet({ projectId: "no-walletconnect" }),
    qrCode: undefined,
    mobile: undefined,
    // Non-headless: with no extension the SDK shows its own QR code (MetaMask relay).
    createConnector: (walletDetails: WalletDetailsParams) =>
      createConnector((config) => {
        const connector = metaMask({
          dappMetadata: { name: app.name, url: app.url, iconUrl: app.icon },
          enableAnalytics: false,
        })(config);
        return {
          ...connector,
          ...walletDetails,
          // RainbowKit awaits getChainId() before connecting; with no extension the SDK throws
          // and the modal would hang. Same guard RainbowKit's own metaMaskWallet uses.
          getChainId: async () => {
            try {
              return await connector.getChainId();
            } catch {
              return config.chains[0]?.id ?? 1;
            }
          },
        };
      }),
  });
}

/**
 * RainbowKit marks injectedWallet always ready, which shows a "Browser Wallet" that silently
 * fails on iPhone Safari / desktop without an extension. Only show it when a provider exists
 * (still needed so in-wallet browsers connect through RainbowKit's mobile options).
 */
const gatedInjectedWallet = (): Wallet => ({
  ...injectedWallet(),
  installed: hasInjectedProvider(),
  hidden: () => !hasInjectedProvider(),
});

/**
 * Wallet list that needs no WalletConnect / Reown project ID:
 * - Injected wallets (extensions, in-wallet browsers): wagmi discovers them through EIP-6963 and
 *   RainbowKit lists them; injectedWallet covers a legacy window.ethereum.
 * - MetaMask SDK, desktop only. On mobile RainbowKit's MetaMask button deep-links via
 *   WalletConnect and breaks, so mobile users reach MetaMask through OpenInWallet instead.
 * - Coinbase Wallet SDK incl. Smart Wallet passkeys (preference "all").
 * Deliberately no rainbowWallet / walletConnectWallet / trustWallet (they use WalletConnect).
 */
export function createWalletConnectors(app: AppMeta) {
  return connectorsForWallets(
    [
      {
        groupName: "Wallets",
        wallets: [gatedInjectedWallet, ...(isMobile() ? [] : [metaMaskSdkWallet(app)]), coinbaseWallet],
      },
    ],
    // Only read by WalletConnect-based wallets, none of which are listed.
    { appName: app.name, appIcon: app.icon, projectId: "no-walletconnect" },
  );
}
