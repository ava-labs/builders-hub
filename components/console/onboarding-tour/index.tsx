"use client";

import * as React from "react";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { CONSOLE_TOUR_STEPS, type TourStep } from "./types";
import { nextPlacement, type Placement } from "./placement";
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
  // con-tour-glide: where the spotlight and card sit, for the step that was measured (rules in ./placement). Until a
  // new step is measured they stay where they are, on the side and padding of the step they point at.
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const [visibleSteps, setVisibleSteps] = React.useState<TourStep[]>([]);
  // When the tour closes, the overlay and card stay 150ms to fade out.
  const [wasActive, setWasActive] = React.useState(isActive);
  const [leaving, setLeaving] = React.useState(false);
  if (wasActive !== isActive) {
    setWasActive(isActive);
    setLeaving(!isActive);
  }
  const showing = isActive || leaving;
  const [waitingForWallet, setWaitingForWallet] = React.useState(false);
  const [isCoreWalletAvailable, setIsCoreWalletAvailable] = React.useState(false);

  // Get wallet connection state and connect function
  const walletEVMAddress = useWalletStore((state) => state.walletEVMAddress);
  const isWalletConnected = !!walletEVMAddress;
  const { openConnectModal } = useConnectModal();

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

  React.useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), 150);
    return () => clearTimeout(timer);
  }, [leaving]);

  // Find and track target element while the tour shows. A closed tour forgets its place (./placement).
  React.useEffect(() => {
    if (!currentStep || !showing) {
      setPlacement((previous) => nextPlacement(previous, { kind: "close" }));
      return;
    }

    // Cleared with the step, so a quick Next never snaps the spotlight back to the previous target.
    let settle: ReturnType<typeof setTimeout> | undefined;
    const findTarget = () => {
      const target = document.querySelector(currentStep.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setPlacement((previous) => nextPlacement(previous, { kind: "stop", step: currentStep, rect }));

        // Scroll into view if needed
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          settle = setTimeout(() => {
            const settled = target.getBoundingClientRect();
            setPlacement((previous) => nextPlacement(previous, { kind: "track", step: currentStep, rect: settled }));
          }, 300);
        }
      }
    };

    const timeout = setTimeout(findTarget, 50);

    const handleResize = () => {
      const target = document.querySelector(currentStep.target);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setPlacement((previous) => nextPlacement(previous, { kind: "track", step: currentStep, rect }));
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      clearTimeout(timeout);
      clearTimeout(settle);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [currentStep, showing]);

  // Navigation handlers
  const handleNext = async () => {
    // If this is the wallet prompt step
    if (currentStep?.isWalletPrompt && !isWalletConnected) {
      // If Core wallet not installed, open download page
      if (!isCoreWalletAvailable) {
        window.open("https://core.app/download", "_blank", "noopener,noreferrer");
        return;
      }

      // Otherwise trigger wallet connection via RainbowKit modal
      setWaitingForWallet(true);
      try {
        openConnectModal?.();
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

  if (!showing || !currentStep || totalSteps === 0) return null;

  const targetRect = placement?.rect ?? null;
  const glide = placement?.glide ?? false;
  const placedStep = placement?.step ?? currentStep;

  return (
    <>
      <TourSpotlight targetRect={targetRect} padding={placedStep.spotlightPadding} glide={glide} leaving={leaving} />
      <TourTooltip
        step={currentStep}
        targetRect={targetRect}
        position={placedStep.position}
        glide={glide}
        leaving={leaving}
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
