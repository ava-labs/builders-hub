"use client";

import * as React from "react";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useWalletConnect } from "@/components/toolbox/hooks/useWalletConnect";
import { CONSOLE_TOUR_STEPS, type TourStep } from "./types";
import { TourSpotlight } from "./tour-spotlight";
import { TourTooltip } from "./tour-tooltip";

// Filter steps based on wallet state and visibility
function getVisibleSteps(isWalletConnected: boolean): TourStep[] {
  return CONSOLE_TOUR_STEPS.filter((step) => {
    // If step requires wallet but wallet not connected, skip
    if (step.requiresWallet && !isWalletConnected) return false;

    // If step is wallet prompt but wallet already connected, skip
    if (step.isWalletPrompt && isWalletConnected) return false;

    const target = document.querySelector(step.target);
    if (!target) return false;

    // Check if element is visible (has dimensions and isn't hidden)
    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  });
}

export function OnboardingTour() {
  const { isActive, currentStepIndex, skipTour, goToStep } = useOnboardingTour();
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [visibleSteps, setVisibleSteps] = React.useState<TourStep[]>([]);
  const [waitingForWallet, setWaitingForWallet] = React.useState(false);
  const [isCoreWalletAvailable, setIsCoreWalletAvailable] = React.useState(false);

  // Get wallet connection state and connect function
  const walletEVMAddress = useWalletStore((state) => state.walletEVMAddress);
  const isWalletConnected = !!walletEVMAddress;
  const { connectWallet } = useWalletConnect();

  // Check if Core wallet is installed
  React.useEffect(() => {
    setIsCoreWalletAvailable(
      typeof window !== "undefined" && !!window.avalanche?.request
    );
  }, []);

  // Calculate visible steps when tour starts or wallet state changes
  React.useEffect(() => {
    if (isActive) {
      const timeout = setTimeout(() => {
        setVisibleSteps(getVisibleSteps(isWalletConnected));
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isActive, isWalletConnected]);

  const currentStep = visibleSteps[currentStepIndex] || null;
  const totalSteps = visibleSteps.length;

  // Auto-advance when wallet connects during wallet prompt step
  React.useEffect(() => {
    if (waitingForWallet && isWalletConnected) {
      setWaitingForWallet(false);
      // Recalculate steps and advance
      const newSteps = getVisibleSteps(true);
      setVisibleSteps(newSteps);
      // Find the wallet-connected step index in the new steps
      const connectedStepIndex = newSteps.findIndex(s => s.id === "wallet-connected");
      if (connectedStepIndex >= 0) {
        goToStep(connectedStepIndex);
      } else {
        // If no wallet-connected step, just move to next
        goToStep(currentStepIndex + 1);
      }
    }
  }, [isWalletConnected, waitingForWallet, currentStepIndex, goToStep]);

  // Timeout to reset waiting state if wallet doesn't connect
  React.useEffect(() => {
    if (!waitingForWallet) return;

    const timeout = setTimeout(() => {
      if (!isWalletConnected) {
        setWaitingForWallet(false);
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeout);
  }, [waitingForWallet, isWalletConnected]);

  // Find and track target element
  React.useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      const target = document.querySelector(currentStep.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);

        // Scroll into view if needed
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            setTargetRect(target.getBoundingClientRect());
          }, 300);
        }
      }
    };

    const timeout = setTimeout(findTarget, 50);

    const handleResize = () => {
      const target = document.querySelector(currentStep.target);
      if (target) setTargetRect(target.getBoundingClientRect());
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [currentStep]);

  // Navigation handlers
  const handleNext = async () => {
    // If this is the wallet prompt step
    if (currentStep?.isWalletPrompt && !isWalletConnected) {
      // If Core wallet not installed, open download page
      if (!isCoreWalletAvailable) {
        window.open("https://core.app/download", "_blank", "noopener,noreferrer");
        return;
      }

      // Otherwise trigger wallet connection
      setWaitingForWallet(true);
      try {
        await connectWallet(); // Actually trigger the wallet popup
        // If still not connected after attempt (user declined), reset waiting state
        // The useEffect watching isWalletConnected will handle success case
      } catch {
        setWaitingForWallet(false);
      }
      return;
    }

    if (currentStepIndex >= totalSteps - 1) {
      skipTour(); // End tour
    } else {
      goToStep(currentStepIndex + 1);
    }
  };

  // Allow skipping wallet step if user doesn't want to connect
  const handleSkipWalletStep = () => {
    setWaitingForWallet(false);
    // Skip to notifications step (past wallet-connected)
    const notificationsIndex = visibleSteps.findIndex(s => s.id === "notifications");
    if (notificationsIndex >= 0) {
      goToStep(notificationsIndex);
    } else {
      goToStep(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  // Keyboard navigation
  React.useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTour();
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentStepIndex, totalSteps, currentStep, isWalletConnected]);

  if (!isActive || !currentStep || totalSteps === 0) return null;

  return (
    <>
      <TourSpotlight targetRect={targetRect} padding={currentStep.spotlightPadding} />
      <TourTooltip
        step={currentStep}
        targetRect={targetRect}
        currentIndex={currentStepIndex}
        totalSteps={totalSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={skipTour}
        onSkipWalletStep={handleSkipWalletStep}
        isFirstStep={currentStepIndex === 0}
        isLastStep={currentStepIndex === totalSteps - 1}
        isWaitingForWallet={waitingForWallet}
        isCoreWalletAvailable={isCoreWalletAvailable}
      />
    </>
  );
}

export { CONSOLE_TOUR_STEPS } from "./types";
export type { TourStep } from "./types";
export { useOnboardingTour } from "@/hooks/useOnboardingTour";
