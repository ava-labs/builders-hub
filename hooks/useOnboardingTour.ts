"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CONSOLE_TOUR_STEPS } from "@/components/console/onboarding-tour/types";

interface OnboardingTourStore {
  // State
  isActive: boolean;
  currentStepIndex: number;
  hasCompletedTour: boolean;
  hasSeenWelcome: boolean;

  // Actions
  startTour: () => void;
  endTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  resetTour: () => void;
  markWelcomeSeen: () => void;
}

export const useOnboardingTour = create<OnboardingTourStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isActive: false,
      currentStepIndex: 0,
      hasCompletedTour: false,
      hasSeenWelcome: false,

      // Actions
      startTour: () => {
        set({ isActive: true, currentStepIndex: 0, hasSeenWelcome: true });
      },

      endTour: () => {
        set({
          isActive: false,
          hasCompletedTour: true,
          hasSeenWelcome: true,
        });
      },

      skipTour: () => {
        set({
          isActive: false,
          hasSeenWelcome: true,
          // Don't mark as completed - they might want to see it later
        });
      },

      nextStep: () => {
        const { currentStepIndex } = get();
        const nextIndex = currentStepIndex + 1;

        if (nextIndex >= CONSOLE_TOUR_STEPS.length) {
          // Tour complete
          set({
            isActive: false,
            hasCompletedTour: true,
            hasSeenWelcome: true,
            currentStepIndex: 0,
          });
        } else {
          set({ currentStepIndex: nextIndex });
        }
      },

      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 });
        }
      },

      goToStep: (index: number) => {
        if (index >= 0 && index < CONSOLE_TOUR_STEPS.length) {
          set({ currentStepIndex: index });
        }
      },

      resetTour: () => {
        set({
          isActive: false,
          currentStepIndex: 0,
          hasCompletedTour: false,
          hasSeenWelcome: false,
        });
      },

      markWelcomeSeen: () => {
        set({ hasSeenWelcome: true });
      },
    }),
    {
      name: "console-onboarding-tour",
      partialize: (state) => ({
        hasCompletedTour: state.hasCompletedTour,
        hasSeenWelcome: state.hasSeenWelcome,
      }),
    }
  )
);
