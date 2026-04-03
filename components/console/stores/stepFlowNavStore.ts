import { create } from "zustand";
import type { StepDefinition } from "../step-flow-v2";

interface StepFlowNavData {
  steps: StepDefinition[];
  currentStepKey: string;
  currentIndex: number;
  basePath: string;
  selectedBranchOptionKey?: string;
}

interface StepFlowNavState {
  data: StepFlowNavData | null;
  /** Token for the current registration — prevents stale unmount from clearing fresh mount */
  token: number;
  /** Whether the header sticks to top when scrolling */
  isPinned: boolean;
  /** Whether the step list is expanded or collapsed */
  isExpanded: boolean;

  register: (data: StepFlowNavData) => number;
  unregister: (token: number) => void;
  togglePin: () => void;
  toggleExpanded: () => void;
}

export const useStepFlowNavStore = create<StepFlowNavState>((set, get) => ({
  data: null,
  token: 0,
  isPinned: true,
  isExpanded: true,

  register: (data) => {
    const next = get().token + 1;
    set({ data, token: next });
    return next;
  },

  unregister: (t) => {
    // Only clear if the token matches (prevents old page unmount from clearing new page)
    if (get().token === t) {
      set({ data: null });
    }
  },

  togglePin: () => set({ isPinned: !get().isPinned }),
  toggleExpanded: () => set({ isExpanded: !get().isExpanded }),
}));
