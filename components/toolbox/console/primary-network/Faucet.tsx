"use client";
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
import { Check } from "lucide-react";

function EVMFaucetCard({ chain }: { chain: L1ListItem }) {
  const dripAmount = chain.faucetThresholds?.dripAmount || 3;
  const { allowed, isLoading } = useFaucetRateLimit({
    faucetType: "evm",
    chainId: chain.evmChainId.toString(),
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <img src={chain.logoUrl} alt={chain.name} className="h-8 w-8 shrink-0" />

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm text-zinc-900 dark:text-white truncate">
          {chain.name}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>
            {dripAmount} {chain.coinName}
          </span>
          {allowed && !isLoading && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Ready
              </span>
            </>
          )}
        </div>
      </div>

      <EVMFaucetButton
        chainId={chain.evmChainId}
        className="shrink-0 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed rounded"
      >
        Drip
      </EVMFaucetButton>
    </div>
  );
}

const metadata: ConsoleToolMetadata = {
  title: "Testnet Faucet",
  description: "Request free test tokens for Fuji testnet and Avalanche L1s",
  toolRequirements: [
    WalletRequirementsConfigKey.TestnetRequired,
    AccountRequirementsConfigKey.UserLoggedIn,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function Faucet({ onSuccess }: BaseConsoleToolProps) {
  const l1List = useL1List();
  const { getChainsWithFaucet } = useTestnetFaucet();
  const EVMChainsWithBuilderHubFaucet = getChainsWithFaucet();

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

  return (
    <div className="max-w-4xl mx-auto not-prose">
      {/* Primary Chains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* C-Chain */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
            Contract Chain
          </h2>

          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-8">
            <div className="flex items-center gap-3 mb-8">
              <img
                src={
                  cChain?.logoUrl ||
                  "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142caa/cchain-square.svg"
                }
                alt="C-Chain"
                className="w-10 h-10 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-white leading-tight">
                    C-Chain
                  </h3>
                  <span className="shrink-0">
                    <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                      {cChain?.faucetThresholds?.dripAmount || 2}
                    </span>
                    <span className="text-sm text-zinc-500 ml-1">
                      {cChain?.coinName || "AVAX"}
                    </span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-zinc-500 leading-tight">
                    Smart contracts & DeFi
                  </p>
                  {cChainAllowed && !cChainLoading && (
                    <span className="text-xs text-green-600 dark:text-green-400 shrink-0 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Ready to claim
                    </span>
                  )}
                </div>
              </div>
            </div>

            <EVMFaucetButton
              chainId={43113}
              className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed rounded"
            >
              Drip
            </EVMFaucetButton>
          </div>
        </div>

        {/* P-Chain */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
            Platform Chain
          </h2>

          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-8">
            <div className="flex items-center gap-3 mb-8">
              <img
                src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                alt="P-Chain"
                className="w-10 h-10 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-white leading-tight">
                    P-Chain
                  </h3>
                  <span className="shrink-0">
                    <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                      0.5
                    </span>
                    <span className="text-sm text-zinc-500 ml-1">AVAX</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-zinc-500 leading-tight">
                    Validators & L1 creation
                  </p>
                  {pChainAllowed && !pChainLoading && (
                    <span className="text-xs text-green-600 dark:text-green-400 shrink-0 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Ready to claim
                    </span>
                  )}
                </div>
              </div>
            </div>

            <PChainFaucetButton className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed rounded">
              Drip
            </PChainFaucetButton>
          </div>
        </div>
      </div>

      {/* Avalanche L1s */}
      {otherEVMChains.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
            Avalanche L1s
          </h2>

          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {otherEVMChains.map((chain: L1ListItem) => (
              <EVMFaucetCard key={chain.id} chain={chain} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-600">
        <span>1 request/chain per 24h</span>
        <span>•</span>
        <span>Test tokens only</span>
        <span>•</span>
        <a
          href="https://core.app/tools/testnet-faucet/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-900 dark:hover:text-white transition-colors underline"
        >
          Core Faucet ↗
        </a>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(Faucet, metadata);
