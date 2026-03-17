"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";

export function WelcomeModal() {
  const { hasSeenWelcome, hasCompletedTour, startTour, markWelcomeSeen, endTour } = useOnboardingTour();
  const [isOpen, setIsOpen] = React.useState(false);
  const [dontShowAgain, setDontShowAgain] = React.useState(true);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Wait for Zustand persist to finish loading from localStorage
  // Note: .persist.hasHydrated() is only safe to call client-side;
  // during SSR/prerendering the persist API may not be attached yet.
  React.useEffect(() => {
    if (useOnboardingTour.persist?.hasHydrated()) {
      setIsHydrated(true);
    } else {
      return useOnboardingTour.persist?.onFinishHydration(() => {
        setIsHydrated(true);
      });
    }
  }, []);

  React.useEffect(() => {
    if (!isHydrated) return;
    if (!hasSeenWelcome && !hasCompletedTour) {
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isHydrated, hasSeenWelcome, hasCompletedTour]);

  const handleStartTour = () => {
    setIsOpen(false);
    startTour();
  };

  const handleSkip = () => {
    setIsOpen(false);
    if (dontShowAgain) {
      endTour(); // Permanently dismiss (sets both hasSeenWelcome + hasCompletedTour)
    } else {
      markWelcomeSeen(); // Only mark welcome seen, tour can still be shown
    }
  };

  if (!isHydrated || hasSeenWelcome || hasCompletedTour) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Builder Console</DialogTitle>
          <DialogDescription>
            Your command center for building on Avalanche
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Take a quick tour to learn where everything is, or skip and explore on your own.
          </p>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            id="dont-show-again"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="dont-show-again" className="text-xs text-muted-foreground cursor-pointer">
            Don&apos;t show again
          </label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleSkip}>
            Skip
          </Button>
          <Button className="flex-1" onClick={handleStartTour}>
            Take the tour
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
