"use client";

import { useState, useEffect } from "react";
import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { ConsoleToolMetadata, withConsoleToolMetadata, BaseConsoleToolProps } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Callout } from "fumadocs-ui/components/callout";
import { PrecompileCodeViewer } from "@/components/console/precompile-code-viewer";
import { Coins, ShieldCheck, ArrowRight } from "lucide-react";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

const metadata: ConsoleToolMetadata = {
  title: "Enable Staking Manager Minting",
  description: "Grant the Native Token Staking Manager permission to mint rewards.",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function EnableStakingManagerMinting({ onSuccess }: BaseConsoleToolProps) {
  const { nativeStakingManagerAddress } = useToolboxStore();
  const [highlightFunction, setHighlightFunction] = useState<string>("mintNativeCoin");

  return (
    <CheckPrecompile
      configKey="contractNativeMinterConfig"
      precompileName="Native Minter"
    >
      <PrecompileCodeViewer
        precompileName="NativeMinter"
        highlightFunction={highlightFunction}
        height="600px"
      >
        <div className="space-y-4">
          {/* Info section */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Coins className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Why Enable Minting?
                </h3>
                <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  The Staking Manager needs permission to mint native tokens as rewards for validators and delegators.
                  Without this permission, the staking rewards system cannot function.
                </p>
              </div>
            </div>
          </div>

          {/* Process visualization */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
              How It Works
            </h4>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span className="text-zinc-700 dark:text-zinc-300">Validator Stakes</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                <span className="text-zinc-700 dark:text-zinc-300">Staking Manager</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 cursor-pointer"
                onClick={() => setHighlightFunction("mintNativeCoin")}
              >
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">mintNativeCoin()</span>
              </div>
            </div>
          </div>

          {/* Detected staking manager */}
          {nativeStakingManagerAddress ? (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                    Staking Manager Detected
                  </h3>
                  <p className="mt-1.5 text-xs text-green-700 dark:text-green-300">
                    Add this address to the Native Minter allowlist:
                  </p>
                  <code className="mt-2 block px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-xs font-mono text-green-800 dark:text-green-200 break-all">
                    {nativeStakingManagerAddress}
                  </code>
                </div>
              </div>
            </div>
          ) : (
            <Callout type="warn">
              <p className="font-semibold mb-1">No Staking Manager Found</p>
              <p className="text-sm">Deploy and initialize a Native Token Staking Manager first.</p>
            </Callout>
          )}

          {/* Allowlist interface buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setHighlightFunction("setEnabled")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                highlightFunction === "setEnabled"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              setEnabled()
            </button>
            <button
              onClick={() => setHighlightFunction("setAdmin")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                highlightFunction === "setAdmin"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              setAdmin()
            </button>
            <button
              onClick={() => setHighlightFunction("readAllowList")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                highlightFunction === "readAllowList"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              readAllowList()
            </button>
            <button
              onClick={() => setHighlightFunction("mintNativeCoin")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                highlightFunction === "mintNativeCoin"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              }`}
            >
              mintNativeCoin()
            </button>
          </div>

          {/* Allowlist component */}
          <div className="mt-6">
            <AllowlistComponent
              precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
              precompileType="Minter"
              defaultEnabledAddress={nativeStakingManagerAddress}
            />
          </div>
        </div>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(EnableStakingManagerMinting, metadata);
