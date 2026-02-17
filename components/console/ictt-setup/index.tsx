"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  Wallet,
  Info,
  Check,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import {
  useICTTSetupStore,
  ICTT_STEPS,
  type ICTTStep,
} from "@/components/toolbox/stores/icttSetupStore";
import { ICTTDeployPanel } from "./deploy-panel";
import { ICTTCodeViewer } from "./code-viewer";

const STEP_ORDER: ICTTStep[] = [
  "select-token",
  "deploy-home",
  "deploy-remote",
  "register",
  "collateral",
];

export function ICTTSetup() {
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const selectedL1 = useSelectedL1()();
  const store = useICTTSetupStore(isTestnet);
  const state = store();

  const isConnected = !!walletEVMAddress && !!selectedL1;
  const [processingStep, setProcessingStep] = useState<ICTTStep | null>(null);

  const progress = useMemo(() => state.getProgress(), [
    state.sourceTokenAddress,
    state.tokenHomeAddress,
    state.tokenRemoteAddress,
    state.isRegistered,
    state.isCollateralized,
  ]);

  const stepAvailability = useMemo(() => ({
    "select-token": true,
    "deploy-home": progress.selectToken,
    "deploy-remote": progress.deployHome,
    "register": progress.deployRemote,
    "collateral": progress.register,
  }), [progress]);

  const completedCount = useMemo(() => {
    return Object.values(progress).filter(Boolean).length;
  }, [progress]);

  const handleStepClick = (step: ICTTStep) => {
    if (stepAvailability[step]) {
      state.setCurrentStep(step);
    }
  };

  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep);
  const currentStepMeta = ICTT_STEPS[state.currentStep];

  if (!isConnected) {
    return <ICTTNotConnected />;
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              ICTT Bridge Setup
            </h3>
            <p className="text-sm text-zinc-500">
              Deploy token transfer contracts between chains
            </p>
          </div>
        </div>
        <div className="text-sm text-zinc-500">
          {completedCount}/5 complete
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Column - Steps + Chain Topology */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chain Topology */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-4">
                Bridge Topology
              </h4>
              <div className="space-y-3">
                {/* Source Chain */}
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  currentStepMeta.chainContext === "home"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
                )}>
                  {selectedL1?.logoUrl ? (
                    <img src={selectedL1.logoUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold">
                      S
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Source
                    </div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {selectedL1?.name}
                    </div>
                  </div>
                  {currentStepMeta.chainContext === "home" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500 text-white uppercase">
                      Active
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className={cn(
                    "w-0.5 h-6 rounded-full",
                    progress.register ? "bg-green-500" : "bg-zinc-200 dark:bg-zinc-700"
                  )} />
                </div>

                {/* Destination Chain */}
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  currentStepMeta.chainContext === "remote"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                    : "border-zinc-200 dark:border-zinc-800"
                )}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-600 flex items-center justify-center text-white text-sm font-bold">
                    D
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Destination
                    </div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {state.remoteChain?.name || "To be configured"}
                    </div>
                  </div>
                  {currentStepMeta.chainContext === "remote" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500 text-white uppercase">
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Steps */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-4">
                Setup Steps
              </h4>
              <div className="space-y-2">
                {STEP_ORDER.map((stepKey, idx) => {
                  const stepMeta = ICTT_STEPS[stepKey];
                  const progressKey = stepKey.replace("-", "") as keyof typeof progress;
                  const isDone = progress[progressKey];
                  const isActive = state.currentStep === stepKey;
                  const isAvailable = stepAvailability[stepKey];

                  return (
                    <button
                      key={stepKey}
                      onClick={() => handleStepClick(stepKey)}
                      disabled={!isAvailable}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        isActive
                          ? "bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700"
                          : isDone
                          ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"
                          : isAvailable
                          ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent"
                          : "opacity-40 cursor-not-allowed border border-transparent"
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          isActive
                            ? "bg-violet-500 text-white"
                            : isDone
                            ? "bg-green-500 text-white"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm font-medium",
                          isActive ? "text-violet-900 dark:text-violet-100" : "text-zinc-900 dark:text-zinc-100"
                        )}>
                          {stepMeta.title}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {stepMeta.chainContext === "home" ? "Source chain" : "Destination chain"}
                        </div>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-violet-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Current Step Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Chain Warning */}
            {currentStepMeta.chainContext === "remote" && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Switch to your <strong>destination chain</strong> in your wallet to complete this step.
                </p>
              </div>
            )}

            {/* Step Content */}
            <ICTTDeployPanel
              currentStep={state.currentStep}
              onStepComplete={(step) => {
                const idx = STEP_ORDER.indexOf(step);
                if (idx < STEP_ORDER.length - 1) {
                  state.setCurrentStep(STEP_ORDER[idx + 1]);
                }
              }}
              onProcessingChange={setProcessingStep}
            />

            {/* Code Viewer */}
            <ICTTCodeViewer
              currentStep={state.currentStep}
              tokenType={state.tokenType}
              expanded={state.expandedCodePanel}
              onToggle={() => state.toggleCodePanel()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ICTTNotConnected() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
          <ArrowLeftRight className="w-7 h-7 text-violet-500" />
        </div>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          ICTT Bridge Setup
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
          Connect your wallet and select an L1 to deploy interchain token transfer contracts.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
          <Wallet className="w-4 h-4" />
          <span className="text-sm">Connect wallet to continue</span>
        </div>
      </div>
    </div>
  );
}

export default ICTTSetup;
