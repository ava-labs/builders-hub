import { useState, useCallback } from "react";
import { StepStatus } from "../components/StepIndicator";

// Define the structure for step configuration (key to label mapping)
export type StepsConfig<T extends string> = {
  [K in T]: string; // Maps step key (string) to a display label (string)
};

// Define the initial state for each step
const initialStepStatus: StepStatus = { status: "pending" };

export function useStepProgress<T extends string>(stepsConfig: StepsConfig<T>) {
  const stepKeys = Object.keys(stepsConfig) as T[];

  // Initialize steps state dynamically based on config
  const initialStepsState = stepKeys.reduce(
    (acc, key) => {
      acc[key] = { ...initialStepStatus };
      return acc;
    },
    {} as Record<T, StepStatus>
  );

  const [steps, setSteps] = useState<Record<T, StepStatus>>(initialStepsState);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessComplete, setIsProcessComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Update the status of a specific step
  const updateStepStatus = useCallback((step: T, status: StepStatus["status"], errorMsg?: string) => {
    setSteps((prev) => ({
      ...prev,
      [step]: { status, error: errorMsg },
    }));
    // Clear general error if a step succeeds or starts loading
    if (status === "success" || status === "loading") {
        setError(null);
    }
    // Set general error if a step fails
    if (status === "error" && errorMsg) {
      setError(errorMsg); // Optionally set a general error too
    }
  }, []);

  // Reset all steps to pending and clear process state
  const resetSteps = useCallback(() => {
    setSteps(initialStepsState);
    setIsProcessing(false);
    setIsProcessComplete(false);
    setError(null);
    setSuccess(null);
  }, [initialStepsState]);

  // Mark the process as started
  const startProcessing = useCallback(() => {
    resetSteps(); // Ensure clean state before starting
    setIsProcessing(true);
  }, [resetSteps]);

  // Mark the process as complete
  const completeProcessing = useCallback((successMsg?: string) => {
      setIsProcessing(true); // Keep processing indicator until user resets
      setIsProcessComplete(true);
      setSuccess(successMsg || "Process completed successfully.");
      setError(null);
  }, []);

  // Handle retrying a step: reset it and subsequent steps, then invoke the action
  const handleRetry = useCallback(async (stepToRetry: T, actionFn: (startFromStep?: T) => Promise<void>) => {
    const stepIndex = stepKeys.indexOf(stepToRetry);
    if (stepIndex === -1) return; // Should not happen

    // Reset statuses from the selected step onwards
    const stepsToReset = stepKeys.slice(stepIndex);
    setSteps((prev) => {
      const newState = { ...prev };
      stepsToReset.forEach((key) => {
        newState[key] = { ...initialStepStatus };
      });
      return newState;
    });

    // Clear completion/error states and ensure processing is active
    setIsProcessComplete(false);
    setError(null);
    setSuccess(null);
    setIsProcessing(true);


    // Re-run the action function starting from the retried step
    await actionFn(stepToRetry);

  }, [stepKeys, initialStepStatus]); // Added initialStepsState dependency


  return {
    steps,
    stepKeys, // Expose step keys for ordered rendering
    stepsConfig, // Expose config for labels
    isProcessing,
    isProcessComplete,
    error,
    success,
    updateStepStatus,
    resetSteps,
    startProcessing,
    completeProcessing,
    handleRetry,
    setError, // Allow setting general error directly if needed
    setSuccess, // Allow setting success message directly
  };
} 