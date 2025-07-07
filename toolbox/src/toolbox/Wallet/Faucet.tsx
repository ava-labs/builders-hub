"use client";
import { useWalletStore } from "../../stores/walletStore";
import { CChainFaucetButton } from "../../components/ConnectWallet/CChainFaucetButton";
import { PChainFaucetButton } from "../../components/ConnectWallet/PChainFaucetButton";
import { Droplet, ChevronRight, Layers, UserPen, Coins, Code } from "lucide-react";

export default function Faucet() {
  const { 
    isTestnet
  } = useWalletStore();

  if (!isTestnet) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8">
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Droplet className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            Faucet Not Available
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Switch to Fuji testnet to request free AVAX tokens
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group block p-6 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
              <img
                src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                alt="C-Chain"
                className="w-6 h-6"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">C-Chain</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">For smart contracts</p>
            </div>
          </div>
          <CChainFaucetButton 
            className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get 2 Tokens
          </CChainFaucetButton>
        </div>

        <div className="group block p-6 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/30">
              <img
                src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                alt="P-Chain"
                className="w-6 h-6"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">P-Chain</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">For staking & validation</p>
            </div>
          </div>
          <PChainFaucetButton 
            className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get 2 Tokens
          </PChainFaucetButton>
        </div>
      </div>

      {/* Quick Links Section */}
      <div className="mt-12">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            Ready to build more?
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Now that you have AVAX tokens, explore these popular tools to start building your L1 blockchain.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => window.location.hash = "createChain"}
            className="group block p-4 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 cursor-pointer relative overflow-hidden"
          >
            <div className="relative h-full min-h-[140px] flex flex-col">
              <div className="mb-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <div className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-300">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight group-hover:text-zinc-800 dark:group-hover:text-zinc-50">
                  Create Chain
                </h3>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
                  Launch your custom L1 blockchain
                </p>
              </div>
              
              <div className="flex justify-end mt-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 group-hover:scale-110">
                  <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200" />
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => window.location.hash = "balanceTopup"}
            className="group block p-4 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 cursor-pointer relative overflow-hidden"
          >
            <div className="relative h-full min-h-[140px] flex flex-col">
              <div className="mb-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <div className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-300">
                    <UserPen className="w-6 h-6" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight group-hover:text-zinc-800 dark:group-hover:text-zinc-50">
                  Validator Balance
                </h3>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
                  Increase L1 validator balance
                </p>
              </div>
              
              <div className="flex justify-end mt-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 group-hover:scale-110">
                  <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200" />
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => window.location.hash = "deployERC20TokenHome"}
            className="group block p-4 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 cursor-pointer relative overflow-hidden"
          >
            <div className="relative h-full min-h-[140px] flex flex-col">
              <div className="mb-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <div className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-300">
                    <Coins className="w-6 h-6" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight group-hover:text-zinc-800 dark:group-hover:text-zinc-50">
                  Deploy Token Home
                </h3>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
                  Deploy token bridge contracts
                </p>
              </div>
              
              <div className="flex justify-end mt-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 group-hover:scale-110">
                  <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200" />
                </div>
              </div>
            </div>
          </div>

          <a
            href="https://build.avax.network/academy/avalanche-fundamentals"
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-4 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 cursor-pointer relative overflow-hidden"
          >
            <div className="relative h-full min-h-[140px] flex flex-col">
              <div className="mb-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <div className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-300">
                    <Code className="w-6 h-6" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight group-hover:text-zinc-800 dark:group-hover:text-zinc-50">
                  Learn More
                </h3>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
                  Avalanche fundamentals guide
                </p>
              </div>
              
              <div className="flex justify-end mt-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 group-hover:scale-110">
                  <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200" />
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}