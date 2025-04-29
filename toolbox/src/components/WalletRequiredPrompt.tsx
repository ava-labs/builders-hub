"use client"

import { Button } from "./Button"

export const WalletRequiredPrompt = () => (
  <div className="space-y-4 max-w-md mx-auto">
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"></div>

      <div className="relative">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full"></div>
            <img src="/core.png" alt="Avalanche Logo" className="h-20 w-auto relative" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-center text-zinc-800 dark:text-zinc-100 mb-4">
          Core Wallet Required
        </h3>
        <p className="text-zinc-600 dark:text-zinc-300 text-center mb-8 leading-relaxed">
          To interact with Avalanche Builders Hub, you'll need to install the Core wallet extension.
        </p>
        <a
          href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-ex/agoakfejjabomempkjlepdflaleeobhb"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <Button className="w-full bg-black hover:bg-zinc-800 text-white font-medium py-4 px-5 rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[1px] transition-all duration-200 flex items-center justify-center">
            Download Core Wallet
          </Button>
        </a>
        <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 mt-6">
          Core is a secure wallet for managing digital assets on Avalanche
        </p>
      </div>
    </div>
  </div>
) 