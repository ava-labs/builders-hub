import { LucideIcon } from "lucide-react";

export interface StepWizardState {
  currentStep: keyof StepListType;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  maxAdvancedStep: keyof StepListType;
  userHasAdvancedBeyondStep: (step: keyof StepListType) => boolean;
  advanceTo: (targetStep: keyof StepListType) => void;
}

export type StepType<StepGroupListType> = {
  title: string;
  component: React.ReactNode;
  group: keyof StepGroupListType;
};

export type StepListType = Record<string, StepType<StepGroupListType>>;

export interface StepGroupType {
  title: string;
  icon: LucideIcon;
}

export type StepGroupListType = Record<string, StepGroupType>;
