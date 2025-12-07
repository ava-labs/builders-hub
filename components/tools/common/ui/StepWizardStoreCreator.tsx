import { StepListType } from "./types";

type CreateStepControlParams<TStepList extends StepListType> = {
  set: (updater: (state: any) => Partial<any>) => void;
  get: () => any;
  stepList: TStepList;
};

export const createStepWizardStore = <TStepList extends StepListType>({
  set,
  get,
  stepList,
}: CreateStepControlParams<TStepList>) => {
  const stepKeys = Object.keys(stepList) as Array<keyof TStepList>;

  return {
    currentStep: stepKeys[0],
    maxAdvancedStep: stepKeys[0],

    goToNextStep: () =>
      set((state) => {
        const currentIndex = stepKeys.indexOf(state.currentStep);
        const nextIndex = currentIndex + 1;
        const maxAdvancedIndex = stepKeys.indexOf(state.maxAdvancedStep);

        if (nextIndex < stepKeys.length) {
          const nextStep = stepKeys[nextIndex];
          if (nextIndex > maxAdvancedIndex) {
            return {
              currentStep: nextStep,
              maxAdvancedStep: nextStep,
            };
          }
          return {
            currentStep: nextStep,
          };
        }
        return state;
      }),

    goToPreviousStep: () =>
      set((state) => {
        const currentIndex = stepKeys.indexOf(state.currentStep);
        if (currentIndex > 0) {
          return { currentStep: stepKeys[currentIndex - 1] };
        }
        return state;
      }),

    advanceTo: (targetStep: keyof TStepList) =>
      set((state) => {
        const targetIndex = stepKeys.indexOf(targetStep);
        const maxAdvancedIndex = stepKeys.indexOf(state.maxAdvancedStep);

        if (targetIndex <= maxAdvancedIndex) {
          return { currentStep: targetStep };
        }
        return state;
      }),

    userHasAdvancedBeyondStep: (step: keyof TStepList) => {
      const stepIndex = stepKeys.indexOf(step);
      const maxAdvancedIndex = stepKeys.indexOf(get().maxAdvancedStep);
      return stepIndex < maxAdvancedIndex;
    },
  };
};
