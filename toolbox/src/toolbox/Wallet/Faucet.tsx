"use client";
import { useWalletStore } from "../../stores/walletStore";
import { CChainFaucetButton } from "../../components/ConnectWallet/CChainFaucetButton";
import { PChainFaucetButton } from "../../components/ConnectWallet/PChainFaucetButton";
import { Droplets, ChevronRight, Layers, UserCheck, Coins, BookOpen, Sparkles, AlertCircle, ExternalLink } from "lucide-react";

interface QuickLinkCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

function QuickLinkCard({ title, description, icon, onClick, href }: QuickLinkCardProps) {
  const Component = href ? 'a' : 'div';
  const props = href 
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { onClick };

  return (
    <Component
      {...props}
      className="group block p-4 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 cursor-pointer relative overflow-hidden"
    >
      <div className="relative h-full min-h-[120px] flex flex-col">
        {/* Icon */}
        <div className="mb-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <div className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-300">
              {icon}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight group-hover:text-zinc-800 dark:group-hover:text-zinc-50 flex items-center gap-2">
            {title}
            {href && <ExternalLink className="w-3 h-3 opacity-50" />}
          </h3>
          
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
            {description}
          </p>
        </div>
        
        {/* Arrow - positioned at bottom right */}
        <div className="flex justify-end mt-3">
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 group-hover:scale-110">
            <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200" />
          </div>
        </div>
      </div>
    </Component>
  );
}

export default function Faucet() {
  const { isTestnet } = useWalletStore();

  if (!isTestnet) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
            Mainnet Mode Active
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The faucet is only available on testnet. Switch to Fuji testnet to request free AVAX tokens for development and testing.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Tip: Use the network switcher in your wallet
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          Fuji Testnet Faucet
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
          Get Test Tokens
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Request free AVAX tokens for testing your applications on Fuji testnet. Each request provides 2 AVAX tokens.
        </p>
      </div>

      {/* Token Request Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* C-Chain Card */}
        <div className="bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md rounded-xl p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <img
                src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                alt="C-Chain"
                className="w-6 h-6"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">C-Chain</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">Smart contract development</p>
            </div>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
              <span className="text-zinc-600 dark:text-zinc-400">EVM-compatible blockchain</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
              <span className="text-zinc-600 dark:text-zinc-400">Deploy smart contracts</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
              <span className="text-zinc-600 dark:text-zinc-400">2 AVAX per request</span>
            </div>
          </div>
          
          <CChainFaucetButton 
            className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Droplets className="w-4 h-4" />
            Request C-Chain Tokens
          </CChainFaucetButton>
        </div>

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
          
          <PChainFaucetButton 
            className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
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
              <li>• Need more tokens? Try the <a href="https://core.app/tools/testnet-faucet/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Core faucet</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Links Section */}
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Start Building
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Now that you have test tokens, explore these tools to begin your journey
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLinkCard
            title="Create L1"
            description="Launch your own blockchain"
            icon={<Layers className="w-6 h-6" />}
            onClick={() => window.location.hash = "createChain"}
          />

          <QuickLinkCard
            title="Validator Tools"
            description="Manage validator operations"
            icon={<UserCheck className="w-6 h-6" />}
            onClick={() => window.location.hash = "balanceTopup"}
          />

          <QuickLinkCard
            title="Token Bridge"
            description="Deploy cross-chain bridges"
            icon={<Coins className="w-6 h-6" />}
            onClick={() => window.location.hash = "deployTokenHome"}
          />

          <QuickLinkCard
            title="Learn More"
            description="Avalanche Academy"
            icon={<BookOpen className="w-6 h-6" />}
            href="https://build.avax.network/academy"
          />
        </div>
      </div>
    </div>
  );
}