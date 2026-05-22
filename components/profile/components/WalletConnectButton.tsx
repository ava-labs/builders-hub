"use client";

import { useEffect, useRef } from "react";
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import {
  avalanche,
  avalancheFuji,
  mainnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  avalanche,
  avalancheFuji,
];

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: avalanche,
  projectId,
  enableReconnect: false,
  metadata: {
    name: "Avalanche Docs",
    description: "Avalanche documentation profile wallet connection",
    url: "https://docs.avax.network",
    icons: ["https://docs.avax.network/favicon.ico"],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
    send: false,
    receive: false,
  },
});

const queryClient = new QueryClient();

interface WalletConnectButtonProps {
  onWalletConnected: (address: string) => void;
}

interface JsonRpcErrorLike {
  code?: unknown;
  message?: unknown;
}

interface JsonRpcErrorResponseLike {
  error?: JsonRpcErrorLike;
}

interface Eip1193RequestArguments {
  method: string;
  params?: unknown;
}

interface Eip1193ProviderLike {
  request(args: Eip1193RequestArguments): Promise<unknown>;
}

interface WindowWithEthereumProvider {
  ethereum?: Eip1193ProviderLike;
}

const revokePermissionsPatchedProviders = new WeakSet<Eip1193ProviderLike>();

function patchUnsupportedRevokePermissions(provider: Eip1193ProviderLike | undefined): void {
  if (!provider || revokePermissionsPatchedProviders.has(provider)) {
    return;
  }

  const originalRequest = provider.request.bind(provider);

  provider.request = (args: Eip1193RequestArguments): Promise<unknown> => {
    if (args.method === "wallet_revokePermissions") {
      return Promise.resolve(null);
    }

    return originalRequest(args);
  };

  revokePermissionsPatchedProviders.add(provider);
}

function isUnsupportedRevokePermissionsError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") {
    return false;
  }

  const directError = reason as JsonRpcErrorLike;
  const nestedError = (reason as JsonRpcErrorResponseLike).error;
  const error = nestedError ?? directError;

  return (
    error.code === -32601 &&
    typeof error.message === "string" &&
    error.message.includes("wallet_revokePermissions")
  );
}

function WalletConnectAddressCapture({
  onWalletConnected,
}: Pick<WalletConnectButtonProps, "onWalletConnected">) {
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { close, open } = useAppKit();
  const { disconnect } = useDisconnect();
  const handledAddressRef = useRef<string | null>(null);
  const onWalletConnectedRef = useRef(onWalletConnected);

  useEffect(() => {
    onWalletConnectedRef.current = onWalletConnected;
  }, [onWalletConnected]);

  useEffect(() => {
    patchUnsupportedRevokePermissions(
      (window as unknown as WindowWithEthereumProvider).ethereum,
    );

    const handleAnnounceProvider = (event: Event) => {
      const provider = (event as CustomEvent<{ provider?: Eip1193ProviderLike }>).detail
        ?.provider;
      patchUnsupportedRevokePermissions(provider);
    };

    const handleUnsupportedRevokePermissions = (event: PromiseRejectionEvent) => {
      if (isUnsupportedRevokePermissionsError(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener("eip6963:announceProvider", handleAnnounceProvider);
    window.addEventListener("unhandledrejection", handleUnsupportedRevokePermissions);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleAnnounceProvider);
      window.removeEventListener("unhandledrejection", handleUnsupportedRevokePermissions);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !address || handledAddressRef.current === address) {
      return;
    }

    handledAddressRef.current = address;
    onWalletConnectedRef.current(address);

    const clearWalletSession = async (): Promise<void> => {
      try {
        await close();
        await disconnect({ namespace: "eip155" });
      } catch (error: unknown) {
        console.error("Error disconnecting Reown wallet session:", error);
      } finally {
        handledAddressRef.current = null;
      }
    };

    void clearWalletSession();
  }, [address, close, disconnect, isConnected]);

  return (
    <Button
      type="button"
      variant="default"
      size="default"
      onClick={() => {
        patchUnsupportedRevokePermissions(
          (window as unknown as WindowWithEthereumProvider).ethereum,
        );
        window.dispatchEvent(new Event("eip6963:requestProvider"));
        void open({ view: "Connect", namespace: "eip155" });
      }}
    >
      <Wallet className="h-4 w-4 mr-2" />
      Connect Wallet
    </Button>
  );
}

export function WalletConnectButton({
  onWalletConnected,
}: WalletConnectButtonProps) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectAddressCapture onWalletConnected={onWalletConnected} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
