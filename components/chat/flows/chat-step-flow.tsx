"use client";

import { useState, useCallback } from "react";
import { Check } from "lucide-react";
import StepFlow, { type StepDefinition } from "@/components/console/step-flow";
import { cn } from "@/lib/utils";

interface ChatStepFlowProps {
  title: string;
  steps: StepDefinition[];
  startAtStep?: string;
}

/**
 * Wraps StepFlow for inline chat rendering.
 * Manages step state in local useState instead of URL routing.
 */
export default function ChatStepFlow({ title, steps, startAtStep }: ChatStepFlowProps) {
  const firstKey = startAtStep || (steps[0].type === "single" ? steps[0].key : steps[0].options[0].key);
  const [currentStepKey, setCurrentStepKey] = useState(firstKey);
  const [isComplete, setIsComplete] = useState(false);

  const handleNavigate = useCallback((stepKey: string) => {
    setCurrentStepKey(stepKey);
  }, []);

  const handleFinish = useCallback(() => {
    setIsComplete(true);
  }, []);

  // Determine progress
  const currentIndex = steps.findIndex((s) => {
    if (s.type === "single") return s.key === currentStepKey;
    return s.options.some((opt) => opt.key === currentStepKey);
  });

  if (isComplete) {
    return (
      <div className="rounded-xl border bg-background p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold">{title} Complete</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          All steps have been completed successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">
          Step {currentIndex + 1} of {steps.length}
        </span>
      </div>

      {/* Flow content — scroll if tall */}
      <div className={cn("max-h-[550px] overflow-y-auto p-4")}>
        <StepFlow
          steps={steps}
          basePath=""
          currentStepKey={currentStepKey}
          onNavigate={handleNavigate}
          onFinish={handleFinish}
          compact
          showCompletionModal={false}
        />
      </div>
    </div>
  );
}
