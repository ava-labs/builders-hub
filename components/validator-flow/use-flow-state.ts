"use client";

import { useEffect, useReducer, useState } from "react";

export interface FlowState {
  readonly stepIndex: number;
  readonly expanded: Readonly<Record<string, boolean>>;
}

export type FlowAction =
  | { readonly type: "next"; readonly stepCount: number }
  | { readonly type: "back" }
  | { readonly type: "goto"; readonly index: number; readonly stepCount: number }
  | { readonly type: "toggle"; readonly section: string };

export const initialFlowState: FlowState = { stepIndex: 0, expanded: {} };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "next":
      return {
        ...state,
        stepIndex: Math.min(state.stepIndex + 1, action.stepCount - 1),
      };
    case "back":
      return { ...state, stepIndex: Math.max(state.stepIndex - 1, 0) };
    case "goto":
      return {
        ...state,
        stepIndex: Math.min(Math.max(action.index, 0), action.stepCount - 1),
      };
    case "toggle":
      return {
        ...state,
        expanded: {
          ...state.expanded,
          [action.section]: !state.expanded[action.section],
        },
      };
  }
}

export function useFlowState() {
  const [state, dispatch] = useReducer(flowReducer, initialFlowState);
  return { state, dispatch } as const;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
