"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CONSOLE_TOUR_STEPS, type TourStep } from "@/components/console/onboarding-tour/types";

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

  // Computed
  currentStep: TourStep | null;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
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
        set({ isActive: true, currentStepIndex: 0 });
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

      // Computed (as getters)
      get currentStep() {
        const { currentStepIndex, isActive } = get();
        if (!isActive) return null;
        return CONSOLE_TOUR_STEPS[currentStepIndex] || null;
      },

      get totalSteps() {
        return CONSOLE_TOUR_STEPS.length;
      },

      get isFirstStep() {
        return get().currentStepIndex === 0;
      },

      get isLastStep() {
        return get().currentStepIndex === CONSOLE_TOUR_STEPS.length - 1;
      },

      get progress() {
        const { currentStepIndex } = get();
        return ((currentStepIndex + 1) / CONSOLE_TOUR_STEPS.length) * 100;
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
