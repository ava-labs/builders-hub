"use client"

import { Button } from "./Button"

interface ConnectWalletPromptProps {
  onConnect: () => void;
}

export const ConnectWalletPrompt = ({ onConnect }: ConnectWalletPromptProps) => (
  <div className="space-y-4 max-w-md mx-auto">
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none"></div>

      <div className="relative">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full"></div>
            <img src="/core-logo.svg" alt="Core Logo" className="h-10 w-auto mt-1 mb-1 dark:hidden" />
            <img src="/core-logo-dark.svg" alt="Core Logo" className="h-10 w-auto mt-1 mb-1 hidden dark:block" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-center text-zinc-800 dark:text-zinc-100 mb-4">
          Connect Core Wallet
        </h3>
        <p className="text-zinc-600 dark:text-zinc-300 text-center mb-8 leading-relaxed">
          Connect your Core wallet to access Avalanche Builder Hub tooling.
        </p>

        <Button
          onClick={onConnect}
          className="w-full bg-black hover:bg-zinc-800 text-white font-medium py-4 px-5 rounded-xl shadow-lg hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[1px] transition-all duration-200 flex items-center justify-center relative group"
        >
          <span className="absolute inset-0 w-full h-full rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
          <span className="relative z-10 text-white">Connect Wallet</span>
        </Button>

        <div className="mt-8 flex items-center justify-center">
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
                <span>Secure connection</span>
              </div>
              <div className="flex items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
                <span>No data sharing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
) 