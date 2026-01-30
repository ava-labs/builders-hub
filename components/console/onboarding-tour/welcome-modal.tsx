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
  const { hasSeenWelcome, startTour, markWelcomeSeen } = useOnboardingTour();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasSeenWelcome]);

  const handleStartTour = () => {
    setIsOpen(false);
    startTour();
  };

  const handleSkip = () => {
    setIsOpen(false);
    markWelcomeSeen();
  };

  if (hasSeenWelcome) return null;

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
