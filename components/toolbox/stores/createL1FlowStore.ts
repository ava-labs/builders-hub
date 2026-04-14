import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { localStorageComp, STORE_VERSION } from './utils';

export type StartingPoint = 'new' | 'convert-existing';
export type VMLocation = 'l1' | 'c-chain';
export type ValidatorType = 'poa' | 'pos-native' | 'pos-erc20';

export interface QuestionnaireAnswers {
  startingPoint: StartingPoint;
  vmLocation: VMLocation;
  validatorType: ValidatorType;
  multisig: boolean;
}

interface CreateL1FlowState {
  answers: QuestionnaireAnswers | null;
  currentStepIndex: number;
  setAnswers: (answers: QuestionnaireAnswers) => void;
  setCurrentStepIndex: (index: number) => void;
  reset: () => void;
}

export const useCreateL1FlowStore = create<CreateL1FlowState>()(
  persist(
    (set) => ({
      answers: null,
      currentStepIndex: 0,
      setAnswers: (answers: QuestionnaireAnswers) => set({ answers }),
      setCurrentStepIndex: (index: number) => set({ currentStepIndex: index }),
      reset: () => set({ answers: null, currentStepIndex: 0 }),
    }),
    {
      name: `${STORE_VERSION}-create-l1-flow`,
      storage: createJSONStorage(localStorageComp),
    },
  ),
);
