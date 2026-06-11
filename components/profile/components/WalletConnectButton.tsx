"use client";

import { useEffect, useRef, useState } from "react";
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
} from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { Loader2, Wallet } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  avalanche,
  avalancheFuji,
  mainnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  EIP712_DOMAIN,
  EIP712_TYPES_FOR_SIGNING,
  EIP712_STATEMENT,
} from "@/lib/profile/walletEip712";

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
  onWalletConnected: (
    address: string,
    signature: string,
    issuedAt: string,
    nonce: string,
  ) => void;
  existingAddresses?: string[];
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

interface WalletOwnershipChallengeResponse {
  nonce: string;
  issuedAt: string;
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
  existingAddresses,
}: Pick<WalletConnectButtonProps, "onWalletConnected" | "existingAddresses">) {
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { close, open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { walletProvider } = useAppKitProvider("eip155");
  const { data: session } = useSession();
  const onWalletConnectedRef = useRef(onWalletConnected);
  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  // Prevents the auto-disconnect effect from firing more than once per alreadySaved=true
  // transition. close() and disconnect() from AppKit are unstable references — without this
  // guard they would cause the effect to re-run on every render, creating an infinite loop.
  const hasAutoDisconnectedRef = useRef(false);

  // Gate on !isSigning so the auto-disconnect never fires while handleVerifyAndAdd is
  // still running. Without this, onWalletConnectedRef.current() updates existingAddresses
  // mid-sign → alreadySaved flips true → disconnect races with the active signing flow.
  const alreadySaved =
    !isSigning &&
    isConnected &&
    address !== undefined &&
    (existingAddresses?.some((a) => a.toLowerCase() === address.toLowerCase()) ?? false);

  useEffect(() => {
    onWalletConnectedRef.current = onWalletConnected;
  }, [onWalletConnected]);

  // Auto-disconnect AppKit session when the connected address is already saved,
  // preventing the same address from appearing twice in the UI.
  useEffect(() => {
    if (!alreadySaved) {
      hasAutoDisconnectedRef.current = false;
      return;
    }
    if (hasAutoDisconnectedRef.current) return;
    hasAutoDisconnectedRef.current = true;
    void (async () => {
      try {
        await close();
        await disconnect({ namespace: "eip155" });
      } catch {
        // Session cleanup is best-effort
      }
    })();
  }, [alreadySaved, close, disconnect]);

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

  const clearSession = async (): Promise<void> => {
    try {
      await close();
      await disconnect({ namespace: "eip155" });
    } catch (error: unknown) {
      console.error("Error disconnecting wallet session:", error);
    }
  };

  const handleVerifyAndAdd = async (): Promise<void> => {
    if (!address || isSigning) return;
    setIsSigning(true);
    setSignError(null);
    try {
      if (!session?.user?.id) {
        throw new Error("Session not ready. Please refresh and try again.");
      }
      if (!walletProvider) {
        throw new Error("Wallet provider not available. Please disconnect and reconnect.");
      }

      const challengeResponse = await fetch(
        `/api/profile/extended/${session.user.id}/wallet-proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        },
      );

      if (!challengeResponse.ok) {
        const errorData: unknown = await challengeResponse.json().catch(() => null);
        const errorMessage =
          errorData && typeof errorData === "object" && "error" in errorData &&
          typeof (errorData as { error?: unknown }).error === "string"
            ? (errorData as { error: string }).error
            : "Failed to request wallet ownership proof.";
        throw new Error(errorMessage);
      }

      const { issuedAt, nonce } = (await challengeResponse.json()) as WalletOwnershipChallengeResponse;
      const signature = await (walletProvider as Eip1193ProviderLike).request({
        method: "eth_signTypedData_v4",
        params: [
          address,
          JSON.stringify({
            domain: EIP712_DOMAIN,
            types: EIP712_TYPES_FOR_SIGNING,
            primaryType: "WalletOwnership",
            message: {
              statement: EIP712_STATEMENT,
              userId: session.user.id,
              walletAddress: address,
              issuedAt,
              nonce,
            },
          }),
        ],
      }) as `0x${string}`;

      onWalletConnectedRef.current(address, signature, issuedAt, nonce);
      await clearSession();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Signing failed. Please try again.";
      // User rejection — don't show a message, just stay on the screen
      if (
        !(error instanceof Error) ||
        !/(user rejected|denied|cancelled|rejected)/i.test(error.message)
      ) {
        setSignError(msg);
      }
      console.error("EIP-712 signing failed:", error);
    } finally {
      setIsSigning(false);
    }
  };

  if (isConnected && address) {
    // alreadySaved triggers auto-disconnect via useEffect above; return null during that transition
    if (alreadySaved) return null;

    const shortened = `${address.slice(0, 8)}...${address.slice(-8)}`;
    return (
      <div className="pr-wallet" style={{ flex: "0 0 100%" }}>
        <div className="pr-top">
          <span className="pr-net">
            <span className="pr-d" /> Avalanche C-Chain
          </span>
          <span className="pr-label">EVM</span>
        </div>
        <div className="pr-bot">
          <div className="pr-addr" title={address}>{shortened}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="pr-btn pr-btn--sm pr-btn--success"
              disabled={isSigning}
              onClick={() => void handleVerifyAndAdd()}
            >
              {isSigning ? (
                <><Loader2 size={12} className="animate-spin" /> Signing…</>
              ) : (
                <><Wallet size={12} /> Verify & Add</>
              )}
            </button>
            <button
              type="button"
              className="pr-btn pr-btn--sm"
              disabled={isSigning}
              onClick={() => void clearSession()}
            >
              Disconnect
            </button>
          </div>
          {signError && (
            <p style={{ color: "#ff6e6f", fontSize: 11, marginTop: 4 }}>{signError}</p>
          )}
        </div>
      </div>
    );
  }

  const hasExistingWallets = (existingAddresses?.length ?? 0) > 0;

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
      {hasExistingWallets ? "Add another wallet" : "Connect Wallet"}
    </Button>
  );
}

export function WalletConnectButton({
  onWalletConnected,
  existingAddresses,
}: WalletConnectButtonProps) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectAddressCapture
          onWalletConnected={onWalletConnected}
          existingAddresses={existingAddresses}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
