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

function EVMFaucetCard({ chain }: { chain: L1ListItem }) {
  const dripAmount = chain.faucetThresholds?.dripAmount || 3;
  
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 py-5 first:pt-0 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={chain.logoUrl} alt={chain.name} className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <h3 className="font-medium text-zinc-900 dark:text-white truncate text-sm">
              {chain.name}
            </h3>
            <p className="text-xs text-zinc-500">
              <span className="font-mono">{dripAmount}</span> {chain.coinName}
            </p>
          </div>
        </div>
        
        <EVMFaucetButton
          chainId={chain.evmChainId}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
        >
          Drip
        </EVMFaucetButton>
      </div>
    </div>
  );
}

const metadata: ConsoleToolMetadata = {
  title: "Testnet Faucet",
  description: "Request free test tokens for Fuji testnet and Avalanche L1s",
  toolRequirements: [
    WalletRequirementsConfigKey.TestnetRequired,
    AccountRequirementsConfigKey.UserLoggedIn
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function Faucet({ onSuccess }: BaseConsoleToolProps) {
  const l1List = useL1List();
  const { getChainsWithFaucet } = useTestnetFaucet();
  const EVMChainsWithBuilderHubFaucet = getChainsWithFaucet();
  
  // Separate C-Chain from other EVM chains
  const cChain = EVMChainsWithBuilderHubFaucet.find((chain) => chain.evmChainId === 43113);
  const otherEVMChains = EVMChainsWithBuilderHubFaucet.filter((chain) => chain.evmChainId !== 43113);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Primary Chains - C-Chain & P-Chain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* C-Chain */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-4">
            Contract Chain
          </h2>
          
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={cChain?.logoUrl || "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142caa/cchain-square.svg"}
                alt="C-Chain"
                className="w-14 h-14"
              />
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-white">C-Chain</h3>
                <p className="text-sm text-zinc-500">Smart contracts & DeFi</p>
              </div>
            </div>
            
            <div className="mb-6">
              <span className="text-3xl font-mono font-semibold text-zinc-900 dark:text-white">
                {cChain?.faucetThresholds?.dripAmount || 2}
              </span>
              <span className="text-sm text-zinc-500 ml-1">{cChain?.coinName || "AVAX"}</span>
            </div>
            
            <EVMFaucetButton
              chainId={43113}
              className="w-full px-4 py-2.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Drip
            </EVMFaucetButton>
          </div>
        </div>

        {/* P-Chain */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-4">
            Platform Chain
          </h2>
          
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="flex items-center gap-4 mb-6">
              <img
                src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                alt="P-Chain"
                className="w-14 h-14"
              />
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-white">P-Chain</h3>
                <p className="text-sm text-zinc-500">Validators & L1 creation</p>
              </div>
            </div>
            
            <div className="mb-6">
              <span className="text-3xl font-mono font-semibold text-zinc-900 dark:text-white">2</span>
              <span className="text-sm text-zinc-500 ml-1">AVAX</span>
            </div>
            
            <PChainFaucetButton className="w-full px-4 py-2.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Drip
            </PChainFaucetButton>
          </div>
        </div>
      </div>

      {/* Other EVM Chains */}
      {otherEVMChains.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-4">
            Avalanche L1s
          </h2>
          
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
            {otherEVMChains.map((chain: L1ListItem) => (
              <EVMFaucetCard key={chain.id} chain={chain} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-600">
        <span>1 request per 24h</span>
        <span>•</span>
        <span>Test tokens only</span>
        <span>•</span>
        <a
          href="https://core.app/tools/testnet-faucet/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Core Faucet ↗
        </a>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(Faucet, metadata);
