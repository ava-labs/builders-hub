"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, QrCode, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { QRCodeSVG } from "qrcode.react";

// Singleton pattern for WalletConnect Provider to prevent multiple initializations
let walletConnectProviderInstance: EthereumProvider | null = null;
let initializationPromise: Promise<EthereumProvider | null> | null = null;

interface WalletProvider {
  name: string;
  icon: string; // Can be emoji or image URL
  iconUrl?: string; // Optional image URL for wallet icons
  id: string;
  available: boolean;
  connect: () => Promise<string | null>;
  type: "extension" | "walletconnect";
}

// EIP-6963 types for wallet discovery
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}

// Known wallet identifiers and their metadata
// Keys can be: rdns (e.g., "io.zerion"), normalized rdns (e.g., "io_zerion"), or name (e.g., "zerion")
const KNOWN_WALLETS: Record<string, { name: string; icon: string; rdns?: string }> = {
  // By rdns (with dots)
  "io.zerion": { name: "Zerion", icon: "Z", rdns: "io.zerion" },
  "io.metamask": { name: "MetaMask", icon: "🦊", rdns: "io.metamask" },
  "com.coinbase.wallet": { name: "Coinbase Wallet", icon: "🔵", rdns: "com.coinbase.wallet" },
  "com.trustwallet.app": { name: "Trust Wallet", icon: "🔒", rdns: "com.trustwallet.app" },
  "com.brave.wallet": { name: "Brave Wallet", icon: "🦁", rdns: "com.brave.wallet" },
  "me.rainbow": { name: "Rainbow", icon: "🌈", rdns: "me.rainbow" },
  "app.frame": { name: "Frame", icon: "🖼️", rdns: "app.frame" },
  "io.rabby": { name: "Rabby", icon: "🐰", rdns: "io.rabby" },
  // By normalized rdns (with underscores)
  "io_zerion": { name: "Zerion", icon: "Z", rdns: "io.zerion" },
  "io_metamask": { name: "MetaMask", icon: "🦊", rdns: "io.metamask" },
  "com_coinbase_wallet": { name: "Coinbase Wallet", icon: "🔵", rdns: "com.coinbase.wallet" },
  "com_trustwallet_app": { name: "Trust Wallet", icon: "🔒", rdns: "com.trustwallet.app" },
  "com_brave_wallet": { name: "Brave Wallet", icon: "🦁", rdns: "com.brave.wallet" },
  "me_rainbow": { name: "Rainbow", icon: "🌈", rdns: "me.rainbow" },
  "app_frame": { name: "Frame", icon: "🖼️", rdns: "app.frame" },
  "io_rabby": { name: "Rabby", icon: "🐰", rdns: "io.rabby" },
  // By name (lowercase, no spaces)
  "zerion": { name: "Zerion", icon: "Z", rdns: "io.zerion" },
  "metamask": { name: "MetaMask", icon: "🦊", rdns: "io.metamask" },
  "coinbasewallet": { name: "Coinbase Wallet", icon: "🔵", rdns: "com.coinbase.wallet" },
  "trustwallet": { name: "Trust Wallet", icon: "🔒", rdns: "com.trustwallet.app" },
  "bravewallet": { name: "Brave Wallet", icon: "🦁", rdns: "com.brave.wallet" },
  "rainbow": { name: "Rainbow", icon: "🌈", rdns: "me.rainbow" },
  "frame": { name: "Frame", icon: "🖼️", rdns: "app.frame" },
  "rabby": { name: "Rabby", icon: "🐰", rdns: "io.rabby" },
  "core": { name: "Core Wallet", icon: "🔷" },
};

export function WalletConnectButton({
  onWalletConnected,
  currentAddress,
}: {
  onWalletConnected: (address: string) => void;
  currentAddress?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletConnectProvider, setWalletConnectProvider] = useState<EthereumProvider | null>(walletConnectProviderInstance);
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [eip6963Providers, setEip6963Providers] = useState<EIP6963ProviderDetail[]>([]);
  const { toast } = useToast();
  
  // Use useRef to maintain stable callback reference
  const onWalletConnectedRef = useRef(onWalletConnected);
  
  // Update reference when callback changes
  useEffect(() => {
    onWalletConnectedRef.current = onWalletConnected;
  }, [onWalletConnected]);

  // Initialize WalletConnect Provider with singleton pattern
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initWalletConnect = async () => {
      try {
        // If already initialized, use existing instance
        if (walletConnectProviderInstance) {
          setWalletConnectProvider(walletConnectProviderInstance);
          return;
        }

        // If initialization is in progress, wait for it
        if (initializationPromise) {
          const provider = await initializationPromise;
          if (provider) {
            setWalletConnectProvider(provider);
          }
          return;
        }

        // Start new initialization
        initializationPromise = (async () => {
          const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
          
          if (!projectId || projectId === "YOUR_PROJECT_ID") {
            console.warn("WalletConnect Project ID not configured. Get one at https://cloud.walletconnect.com");
            return null;
          }

          const provider = await EthereumProvider.init({
            projectId: projectId,
            chains: [1, 43114, 43113], // Ethereum, Avalanche Mainnet, Avalanche Fuji
            showQrModal: false, // Disable automatic modal to use our own
          });

          // Store singleton instance
          walletConnectProviderInstance = provider;
          
          return provider;
        })();

        const provider = await initializationPromise;
        
        if (!provider) return;

        // Setup event listeners
        provider.on("display_uri", (uri: string) => {
          setQrCodeUri(uri);
          setShowQRCode(true);
          setIsConnecting(true);
        });

        provider.on("connect", () => {
          const accounts = provider.accounts;
          if (accounts && accounts.length > 0) {
            setIsConnecting(false);
            onWalletConnectedRef.current(accounts[0]);
            setIsOpen(false);
            setShowQRCode(false);
            setQrCodeUri(null);
            toast({
              title: "Wallet Connected",
              description: "Successfully connected via WalletConnect",
            });
          }
        });

        provider.on("disconnect", () => {
          onWalletConnectedRef.current("");
          setShowQRCode(false);
          setQrCodeUri(null);
        });

        setWalletConnectProvider(provider);
      } catch (error) {
        console.error("Error initializing WalletConnect:", error);
        initializationPromise = null; // Reset on error to allow retry
      }
    };

    initWalletConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Setup EIP-6963 wallet discovery
  useEffect(() => {
    if (typeof window === "undefined") return;

    const providers: EIP6963ProviderDetail[] = [];

    const handleAnnounceProvider = (event: CustomEvent<EIP6963ProviderDetail>) => {
      const detail = event.detail;
      // Avoid duplicates
      if (!providers.find(p => p.info.uuid === detail.info.uuid)) {
        providers.push(detail);
        setEip6963Providers([...providers]);
        console.log('EIP-6963 wallet detected:', detail.info.name, detail.info.rdns);
      }
    };

    // Listen for wallet announcements
    window.addEventListener("eip6963:announceProvider", handleAnnounceProvider as EventListener);

    // Request wallet providers to announce themselves
    // Some wallets announce immediately, others need a request
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    
    // Also try after a short delay in case wallets load asynchronously
    const timeoutId = setTimeout(() => {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("eip6963:announceProvider", handleAnnounceProvider as EventListener);
    };
  }, []);

  
  const detectWallets = (): WalletProvider[] => {
    const wallets: WalletProvider[] = [];
    const detectedIds = new Set<string>();

    if (typeof window === "undefined") {
      return wallets;
    }

 

    // WalletConnect (for mobile wallets) - only if initialized
    if (walletConnectProvider) {
      wallets.push({
        name: "WalletConnect",
        icon: "🔗",
        id: "walletconnect",
        available: true,
        type: "walletconnect",
        connect: async () => {
          if (!walletConnectProvider) {
            throw new Error("WalletConnect not initialized");
          }
          try {
            setIsConnecting(true);
            // enable() generates the QR code and triggers the display_uri event immediately
            // Then waits for the user to scan and approve the connection
            await walletConnectProvider.enable();
            const accounts = walletConnectProvider.accounts;
            return accounts?.[0] || null;
          } catch (error: any) {
            setIsConnecting(false);
            setShowQRCode(false);
            setQrCodeUri(null);
            if (error.code === 4001) {
              throw new Error("Connection rejected");
            }
            throw error;
          }
        },
      });
      detectedIds.add("walletconnect");
    }

    // EIP-6963: Modern wallet discovery standard
    // Process EIP-6963 providers from state
    eip6963Providers.forEach((detail) => {
      const { info, provider } = detail;
      
      // Try multiple matching strategies
      const rdnsKey = info.rdns || '';
      const rdnsKeyNormalized = info.rdns?.replace(/\./g, '_') || '';
      const nameKey = info.name.toLowerCase().replace(/\s+/g, '');
      
      // Match wallet info from KNOWN_WALLETS using multiple keys
      const walletInfo = KNOWN_WALLETS[rdnsKey] || 
                        KNOWN_WALLETS[rdnsKeyNormalized] || 
                        KNOWN_WALLETS[nameKey] || { 
                          name: info.name, 
                          icon: "💼" 
                        };

      // Use the icon from EIP-6963 if available (it's a base64 data URL or URL)
      const iconUrl = info.icon && (info.icon.startsWith('data:') || info.icon.startsWith('http')) 
        ? info.icon 
        : undefined;

      // Create unique ID from rdns or name
      const walletId = info.rdns || nameKey;
      
      // Check if already detected
      if (!detectedIds.has(walletId) && 
          !detectedIds.has(rdnsKey) && 
          !detectedIds.has(rdnsKeyNormalized) && 
          !detectedIds.has(nameKey)) {
        wallets.push({
          name: walletInfo.name,
          icon: iconUrl ? "💼" : walletInfo.icon, // Use emoji fallback if we have iconUrl, otherwise use known icon
          iconUrl: iconUrl, // Use real wallet icon if available
          id: walletId,
          available: true,
          type: "extension",
          connect: async () => {
            try {
              const accounts = await provider.request({
                method: "eth_requestAccounts",
              }) as string[];
              return accounts?.[0] || null;
            } catch (error: any) {
              if (error.code === 4001) {
                throw new Error(`Please connect to ${walletInfo.name}.`);
              }
              throw error;
            }
          },
        });
        // Mark all variations as detected to avoid duplicates
        detectedIds.add(walletId);
        if (info.rdns) {
          detectedIds.add(info.rdns);
          detectedIds.add(rdnsKeyNormalized);
        }
        detectedIds.add(nameKey);
      }
    });

    // Legacy detection: MetaMask (check isMetaMask flag first to avoid duplicates)
    if ((window.ethereum as any)?.isMetaMask && !detectedIds.has("metamask")) {
      wallets.push({
        name: "MetaMask",
        icon: "🦊",
        id: "metamask",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await (window.ethereum as any)!.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to MetaMask.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("metamask");
    }

    // Zerion Wallet detection (window.zerion)
    // Check both window.zerion and if it's already detected via EIP-6963
    if (window.zerion && 
        !detectedIds.has("zerion") && 
        !detectedIds.has("io.zerion") && 
        !detectedIds.has("io_zerion")) {
      wallets.push({
        name: "Zerion",
        icon: "Z",
        id: "zerion",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await window.zerion!.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to Zerion.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("zerion");
      detectedIds.add("io.zerion");
      detectedIds.add("io_zerion");
    }

    // Coinbase Wallet detection (window.coinbaseWalletExtension)
    if ((window as any).coinbaseWalletExtension && !detectedIds.has("coinbase")) {
      wallets.push({
        name: "Coinbase Wallet",
        icon: "🔵",
        id: "coinbase",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await (window as any).coinbaseWalletExtension.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to Coinbase Wallet.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("coinbase");
    }

    // Core Wallet (Avalanche wallet)
    if ((window as any).avalanche?.request && !detectedIds.has("core")) {
      wallets.push({
        name: "Core Wallet",
        icon: "🔷",
        id: "core",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await window.avalanche!.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to Core Wallet.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("core");
    }

    // Brave Wallet detection
    if ((window.ethereum as any)?.isBraveWallet && !detectedIds.has("brave")) {
      wallets.push({
        name: "Brave Wallet",
        icon: "🦁",
        id: "brave",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await (window.ethereum as any)!.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to Brave Wallet.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("brave");
    }

    // Rainbow Wallet detection
    if ((window.ethereum as any)?.isRainbow && !detectedIds.has("rainbow")) {
      wallets.push({
        name: "Rainbow",
        icon: "🌈",
        id: "rainbow",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await (window.ethereum as any)!.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to Rainbow.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("rainbow");
    }

    // Other EIP-1193 providers (fallback for unknown wallets)
    if (
      window.ethereum &&
      !(window.ethereum as any).isMetaMask &&
      !(window.ethereum as any).isBraveWallet &&
      !(window.ethereum as any).isRainbow &&
      !detectedIds.has("other")
    ) {
      wallets.push({
        name: "Other Wallet",
        icon: "💼",
        id: "other",
        available: true,
        type: "extension",
        connect: async () => {
          try {
            const accounts = await (window.ethereum as any)!.request({
              method: "eth_requestAccounts",
            }) as string[];
            return accounts?.[0] || null;
          } catch (error: any) {
            if (error.code === 4001) {
              throw new Error("Please connect to your wallet.");
            }
            throw error;
          }
        },
      });
      detectedIds.add("other");
    }

    console.log(`Total wallets detected: ${wallets.length}`, wallets.map(w => w.name));
    return wallets;
  };

  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);

  // update available wallets when the WalletConnect provider or EIP-6963 providers change
  useEffect(() => {
    setAvailableWallets(detectWallets());
  }, [walletConnectProvider, eip6963Providers]);

  // Listen for account changes in MetaMask
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum || !currentAddress) {
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0 && currentAddress) {
        // Use stable reference instead of the function directly
        onWalletConnectedRef.current(accounts[0]);
      }
    };

    const ethereum = window.ethereum as any;
    ethereum.on?.("accountsChanged", handleAccountsChanged);
    
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [currentAddress]);

  const handleConnect = async (wallet: WalletProvider) => {
    setIsConnecting(true);
    try {
      if (wallet.type === "walletconnect") {
    
        await wallet.connect();
     
      } else {
      
        const address = await wallet.connect();
        if (address) {
          onWalletConnected(address);
          setIsOpen(false);
          setIsConnecting(false);
          toast({
            title: "Wallet Connected",
            description: `Successfully connected to ${wallet.name}`,
          });
        }
      }
    } catch (error: any) {
      setIsConnecting(false);
      setShowQRCode(false);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectWalletConnect = async () => {
    if (walletConnectProvider) {
      try {
        await walletConnectProvider.disconnect();
        onWalletConnected("");
        setShowQRCode(false);
        setQrCodeUri(null);
      } catch (error) {
        console.error("Error disconnecting WalletConnect:", error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setShowQRCode(false);
        setQrCodeUri(null);
        setIsConnecting(false);
      }
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="default" size="default">
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            {showQRCode 
              ? "Scan the QR code with your mobile wallet" 
              : "Select a wallet to connect to your account"}
          </DialogDescription>
        </DialogHeader>
        
        {showQRCode && qrCodeUri ? (
          <div className="space-y-4 mt-4">
            <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
              <div className="w-full max-w-xs p-4 bg-white rounded-lg flex items-center justify-center mb-4">
                <QRCodeSVG
                  value={qrCodeUri}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              {isConnecting ? (
                <div className="flex flex-col items-center gap-2 mb-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Waiting for connection...
                  </p>
                </div>
              ) : null}
              <p className="text-sm text-center text-muted-foreground">
                Scan this QR code with your mobile wallet app
              </p>
              <p className="text-xs text-center text-muted-foreground">
                Or copy the connection link if your wallet supports it
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowQRCode(false);
                setQrCodeUri(null);
                setIsConnecting(false);
                if (walletConnectProvider) {
                  handleDisconnectWalletConnect();
                }
              }}
            >
              Cancel
            </Button>
          </div>
        ) : isConnecting && !showQRCode ? (
          <div className="space-y-4 mt-4">
            <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Preparing connection...
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsConnecting(false);
                if (walletConnectProvider) {
                  handleDisconnectWalletConnect();
                }
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {availableWallets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  No wallets detected
                </p>
                <p className="text-sm text-muted-foreground">
                  Please install MetaMask or Core Wallet extension, or use WalletConnect
                </p>
              </div>
            ) : (
              availableWallets.map((wallet) => (
                <Button
                  key={wallet.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={() => handleConnect(wallet)}
                  disabled={isConnecting || !wallet.available}
                >
                  {wallet.iconUrl ? (
                    <img 
                      src={wallet.iconUrl} 
                      alt={wallet.name}
                      className="w-8 h-8 mr-3 rounded"
                    />
                  ) : (
                    <span className="text-2xl mr-3">{wallet.icon}</span>
                  )}
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-medium">{wallet.name}</span>
                    {wallet.type === "walletconnect" && (
                      <span className="text-xs text-muted-foreground">
                        Mobile & Desktop wallets
                      </span>
                    )}
                    {!wallet.available && (
                      <span className="text-xs text-muted-foreground">
                        Not available
                      </span>
                    )}
                  </div>
                </Button>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

