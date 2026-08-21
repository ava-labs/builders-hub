import { describe, expect, it } from "vitest";
import {
  flowReducer,
  initialFlowState,
} from "../../../components/validator-flow/use-flow-state";

describe("flowReducer", () => {
  it("advances and clamps at the last step", () => {
    const s1 = flowReducer(initialFlowState, { type: "next", stepCount: 2 });
    expect(s1.stepIndex).toBe(1);
    const s2 = flowReducer(s1, { type: "next", stepCount: 2 });
    expect(s2.stepIndex).toBe(1);
  });

  it("goes back and clamps at zero", () => {
    const s = flowReducer(initialFlowState, { type: "back" });
    expect(s.stepIndex).toBe(0);
  });

  it("jumps to a clamped index", () => {
    const s = flowReducer(initialFlowState, {
      type: "goto",
      index: 99,
      stepCount: 6,
    });
    expect(s.stepIndex).toBe(5);
  });

  it("toggles expansion immutably", () => {
    const s1 = flowReducer(initialFlowState, {
      type: "toggle",
      section: "initiate:operator",
    });
    expect(s1.expanded["initiate:operator"]).toBe(true);
    expect(initialFlowState.expanded["initiate:operator"]).toBeUndefined();
    const s2 = flowReducer(s1, { type: "toggle", section: "initiate:operator" });
    expect(s2.expanded["initiate:operator"]).toBe(false);
  });
});
