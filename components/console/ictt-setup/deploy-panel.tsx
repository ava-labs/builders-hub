"use client";

import type { ICTTStep } from "@/components/toolbox/stores/icttSetupStore";
import { ICTT_STEPS } from "@/components/toolbox/stores/icttSetupStore";

import { SelectTokenStep } from "./steps/select-token";
import { DeployHomeStep } from "./steps/deploy-home";
import { DeployRemoteStep } from "./steps/deploy-remote";
import { RegisterStep } from "./steps/register";
import { CollateralStep } from "./steps/collateral";

interface ICTTDeployPanelProps {
  currentStep: ICTTStep;
  onStepComplete: (step: ICTTStep) => void;
  onProcessingChange: (step: ICTTStep | null) => void;
}

export function ICTTDeployPanel({
  currentStep,
  onStepComplete,
  onProcessingChange,
}: ICTTDeployPanelProps) {
  const stepMeta = ICTT_STEPS[currentStep];

  return (
    <div className="space-y-4">
      {/* Step Title */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {stepMeta.title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {stepMeta.description}
          {stepMeta.chainContext === "remote" && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              (Destination chain)
            </span>
          )}
        </p>
      </div>

      {/* Step Content */}
      <StepContent
        step={currentStep}
        onComplete={() => onStepComplete(currentStep)}
        onProcessing={(processing) => onProcessingChange(processing ? currentStep : null)}
      />
    </div>
  );
}

interface StepContentProps {
  step: ICTTStep;
  onComplete: () => void;
  onProcessing: (processing: boolean) => void;
}

function StepContent({ step, onComplete, onProcessing }: StepContentProps) {
  switch (step) {
    case "select-token":
      return <SelectTokenStep onComplete={onComplete} onProcessing={onProcessing} />;
    case "deploy-home":
      return <DeployHomeStep onComplete={onComplete} onProcessing={onProcessing} />;
    case "deploy-remote":
      return <DeployRemoteStep onComplete={onComplete} onProcessing={onProcessing} />;
    case "register":
      return <RegisterStep onComplete={onComplete} onProcessing={onProcessing} />;
    case "collateral":
      return <CollateralStep onComplete={onComplete} onProcessing={onProcessing} />;
    default:
      return <div>Unknown step</div>;
  }
}

export default ICTTDeployPanel;
