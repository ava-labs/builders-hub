"use client";
import { EVMFaucetButton } from "@/components/toolbox/components/ConnectWallet/EVMFaucetButton";
import { PChainFaucetButton } from "@/components/toolbox/components/ConnectWallet/PChainFaucetButton";
import { Droplets, Sparkles, AlertCircle } from "lucide-react";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { useL1List, L1ListItem } from "@/components/toolbox/stores/l1ListStore";

function EVMFaucetCard({ chain }: { chain: L1ListItem }) {
  const getFeatures = () => {
    const baseFeatures = chain.features || [];
    const dripAmount = chain.dripAmount || 3;
    const dripFeature = `${dripAmount} ${chain.coinName} ${chain.coinName === "AVAX" ? "per request" : "tokens per request"
      }`;
    return [...baseFeatures, dripFeature];
  };

  return (
    <div className="bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md rounded-xl p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <img src={chain.logoUrl} alt={chain.name} className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
            {chain.name}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            {chain.description}
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {getFeatures().map((feature, index) => (
          <div key={index} className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
            <span className="text-zinc-600 dark:text-zinc-400">{feature}</span>
          </div>
        ))}
      </div>

      <EVMFaucetButton
        chainId={chain.evmChainId}
        className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Droplets className="w-4 h-4" />
        Request {chain.name} Tokens
      </EVMFaucetButton>
    </div>
  );
}

export default function Faucet() {
  const l1List = useL1List();
  const EVMChainsWithBuilderHubFaucet = l1List.filter(
    (chain: L1ListItem) => chain.hasBuilderHubFaucet
  );

  return (
    <CheckWalletRequirements
      configKey={[WalletRequirementsConfigKey.TestnetRequired]}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Fuji Testnet Faucet
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">Get Test Tokens</h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Request free tokens for testing your applications on Fuji testnet
            and Avalanche L1s.
          </p>
        </div>

        {/* Token Request Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dynamic EVM Chain FaucetCards */}
          {EVMChainsWithBuilderHubFaucet.map((chain: L1ListItem) => (
            <EVMFaucetCard key={chain.id} chain={chain} />
          ))}

          {/* P-Chain Card */}
          <div className="bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md rounded-xl p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <img
                  src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                  alt="P-Chain"
                  className="w-6 h-6"
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">P-Chain</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">Staking & validation</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
                <span className="text-zinc-600 dark:text-zinc-400">Platform chain for validators</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
                <span className="text-zinc-600 dark:text-zinc-400">Manage validators and create L1s</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
                <span className="text-zinc-600 dark:text-zinc-400">2 AVAX per request</span>
              </div>
            </div>

            <PChainFaucetButton className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Droplets className="w-4 h-4" />
              Request P-Chain Tokens
            </PChainFaucetButton>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-zinc-800/50 border border-blue-200 dark:border-zinc-700 rounded-xl p-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-zinc-700 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-zinc-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-900 dark:text-white">Important Information</h4>
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• You can request tokens once every 24 hours for either chain</li>
                <li>• Make sure your wallet is connected to Fuji testnet</li>
                <li>• These tokens have no real value and are for testing only</li>
                <li>• Need more tokens? Try the{" "}<a href="https://core.app/tools/testnet-faucet/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Core faucet</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </CheckWalletRequirements>
  );
}
