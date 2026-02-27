"use client";
import { useState, useCallback } from "react";
import { EVMFaucetButton } from "@/components/toolbox/components/ConnectWallet/EVMFaucetButton";
import { PChainFaucetButton } from "@/components/toolbox/components/ConnectWallet/PChainFaucetButton";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { useL1List, L1ListItem } from "@/components/toolbox/stores/l1ListStore";

import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from "../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { useTestnetFaucet } from "@/hooks/useTestnetFaucet";
import { AccountRequirementsConfigKey } from "../../hooks/useAccountRequirements";
import { useFaucetRateLimit } from "@/hooks/useFaucetRateLimit";
import { useFaucetBalance } from "@/hooks/useFaucetBalance";
import { Check, Droplets, ExternalLink, Clock, Wallet, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

function FaucetBalanceDisplay({
  balance,
  symbol,
  isLoading,
  error
}: {
  balance?: string;
  symbol: string;
  isLoading: boolean;
  error?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <Wallet className="w-3 h-3" />
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading faucet balance...</span>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <Wallet className="w-3 h-3" />
        <span>Faucet balance unavailable</span>
      </div>
    );
  }

  const balanceNum = parseFloat(balance);
  const isLow = balanceNum < 10;

  return (
    <div className={`flex items-center gap-1.5 text-xs ${
      isLow
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-zinc-500 dark:text-zinc-400'
    }`}>
      <Wallet className="w-3 h-3" />
      <span>Faucet:</span>
      <span className="font-mono">{balance}</span>
      <span>{symbol}</span>
      {isLow && <span className="text-[10px]">(low)</span>}
    </div>
  );
}

function EVMFaucetCard({ chain }: { chain: L1ListItem }) {
  const dripAmount = chain.faucetThresholds?.dripAmount || 3;
  const { allowed, isLoading } = useFaucetRateLimit({
    faucetType: "evm",
    chainId: chain.evmChainId.toString(),
  });
  const { getBalanceForChain, isLoading: balanceLoading, error: balanceError } = useFaucetBalance();
  const chainBalance = getBalanceForChain(chain.evmChainId);

  return (
    <div className="flex items-center gap-4 p-4 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="relative">
        <img src={chain.logoUrl} alt={chain.name} className="h-10 w-10 rounded-lg" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
            {chain.name}
          </h3>
          {!isLoading && (
            allowed ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <Check className="w-3 h-3" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                <Clock className="w-3 h-3" /> Cooldown
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
            {dripAmount} {chain.coinName}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">•</span>
          <FaucetBalanceDisplay
            balance={chainBalance?.balanceFormatted}
            symbol={chain.coinName}
            isLoading={balanceLoading}
            error={!!balanceError}
          />
        </div>
      </div>

      <EVMFaucetButton
        chainId={chain.evmChainId}
        className="shrink-0 px-4 py-2 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
      >
        Drip
      </EVMFaucetButton>
    </div>
  );
}

function ManualPChainFaucetInput() {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [success, setSuccess] = useState(false);
  const { notify } = useConsoleNotifications();

  const handleClaim = useCallback(async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    // Auto-prepend P-chain prefix if user pasted bare address from CLI
    const normalizedAddress = trimmed.startsWith("P-")
      ? trimmed
      : `P-fuji1${trimmed}`;

    setError(null);
    setIsClaiming(true);
    setSuccess(false);

    try {
      const faucetRequest = async () => {
        const response = await fetch(`/api/pchain-faucet?address=${encodeURIComponent(normalizedAddress)}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error(data.message || "Rate limit exceeded. Please try again later.");
          }
          throw new Error(data.message || `Error ${response.status}: Failed to get tokens`);
        }

        if (!data.success) {
          throw new Error(data.message || "Failed to get tokens");
        }

        return data;
      };

      const faucetPromise = faucetRequest();
      notify({ type: "local", name: "P-Chain Manual Faucet Claim" }, faucetPromise);

      await faucetPromise;
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to claim tokens");
    } finally {
      setIsClaiming(false);
    }
  }, [address, notify]);

  return (
    <div className="mt-3 pt-3 border-t border-zinc-200/80 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
        Using platform-cli? Paste your address from{" "}
        <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">
          platform wallet balance
        </code>
        {" "}&mdash; the <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono">P-fuji1</code> prefix is added automatically.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError(null);
            setSuccess(false);
          }}
          placeholder="P-fuji1..."
          className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
        />
        <button
          onClick={handleClaim}
          disabled={isClaiming || !address}
          className="shrink-0 px-4 py-2 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
        >
          {isClaiming ? "Claiming..." : success ? "Claimed!" : "Claim"}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
      {success && (
        <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
          Tokens sent successfully!
        </p>
      )}
    </div>
  );
}

const metadata: ConsoleToolMetadata = {
  title: "Testnet Faucet",
  description: "Request free test tokens for Fuji testnet and Avalanche L1s",
  toolRequirements: [
    WalletRequirementsConfigKey.WalletConnected,
    AccountRequirementsConfigKey.UserLoggedIn,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function Faucet({ onSuccess }: BaseConsoleToolProps) {
  const l1List = useL1List();
  const { getChainsWithFaucet } = useTestnetFaucet();
  const EVMChainsWithBuilderHubFaucet = getChainsWithFaucet();
  const { balances, isLoading: balancesLoading, error: balancesError, refetch } = useFaucetBalance();

  const cChain = EVMChainsWithBuilderHubFaucet.find(
    (chain) => chain.evmChainId === 43113
  );
  const otherEVMChains = EVMChainsWithBuilderHubFaucet.filter(
    (chain) => chain.evmChainId !== 43113
  );

  const { allowed: cChainAllowed, isLoading: cChainLoading } =
    useFaucetRateLimit({
      faucetType: "evm",
      chainId: "43113",
    });

  const { allowed: pChainAllowed, isLoading: pChainLoading } =
    useFaucetRateLimit({
      faucetType: "pchain",
    });

  const cChainBalance = balances?.evmChains.find(c => c.chainId === 43113);

  return (
    <div className="max-w-4xl mx-auto not-prose space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
          Primary Network
        </label>
        <button
          onClick={() => refetch()}
          disabled={balancesLoading}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${balancesLoading ? 'animate-spin' : ''}`} />
          Refresh balances
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* C-Chain Card */}
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={
                    cChain?.logoUrl ||
                    "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                  }
                  alt="C-Chain"
                  className="w-12 h-12 rounded-lg"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <Droplets className="w-3 h-3 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                    C-Chain
                  </h3>
                  {!cChainLoading && (
                    cChainAllowed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        <Clock className="w-3 h-3" /> Cooldown
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Smart contracts & DeFi
                </p>

                {/* Drip amount and faucet balance */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {cChain?.faucetThresholds?.dripAmount || 0.5}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {cChain?.coinName || "AVAX"}
                    </span>
                  </div>
                  <FaucetBalanceDisplay
                    balance={cChainBalance?.balanceFormatted}
                    symbol={cChainBalance?.symbol || "AVAX"}
                    isLoading={balancesLoading}
                    error={!!balancesError}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <EVMFaucetButton
              chainId={43113}
              className="w-full px-4 py-2.5 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              Request Tokens
            </EVMFaucetButton>
          </div>
        </div>

        {/* P-Chain Card */}
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                  alt="P-Chain"
                  className="w-12 h-12 rounded-lg"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                  <Droplets className="w-3 h-3 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                    P-Chain
                  </h3>
                  {!pChainLoading && (
                    pChainAllowed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        <Clock className="w-3 h-3" /> Cooldown
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Validators & L1 creation
                </p>

                {/* Drip amount and faucet balance */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      0.5
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      AVAX
                    </span>
                  </div>
                  <FaucetBalanceDisplay
                    balance={balances?.pChain?.balanceFormatted}
                    symbol="AVAX"
                    isLoading={balancesLoading}
                    error={!!balancesError}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <PChainFaucetButton className="w-full px-4 py-2.5 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg">
              Request Tokens
            </PChainFaucetButton>
            <ManualPChainFaucetInput />
          </div>
        </div>
      </div>

      {/* Avalanche L1s */}
      {otherEVMChains.length > 0 && (
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Avalanche L1s
          </label>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            {otherEVMChains.map((chain: L1ListItem) => (
              <EVMFaucetCard key={chain.id} chain={chain} />
            ))}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            1 request per chain / 24h
          </span>
          <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">•</span>
          <span>Test tokens only</span>
        </div>

        <a
          href="https://core.app/tools/testnet-faucet/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          Core Faucet
          <ExternalLink className="w-3 h-3" />
        </a>
        <span>•</span>
        <Link
          href="/console/primary-network/devnet-faucet"
          className="hover:text-zinc-900 dark:hover:text-white transition-colors underline"
        >
          Devnet Faucet
        </Link>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(Faucet, metadata);
