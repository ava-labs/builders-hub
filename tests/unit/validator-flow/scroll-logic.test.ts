import { describe, expect, it } from "vitest";
import {
  beatStartFraction,
  progressToStepIndex,
} from "../../../components/validator-flow/scroll-logic";

describe("progressToStepIndex", () => {
  it("clamps below zero to the first step", () => {
    expect(progressToStepIndex(-0.2, 6)).toBe(0);
  });

  it("maps beat boundaries exactly", () => {
    expect(progressToStepIndex(0, 6)).toBe(0);
    expect(progressToStepIndex(1 / 6 - 0.001, 6)).toBe(0);
    expect(progressToStepIndex(1 / 6, 6)).toBe(1);
    expect(progressToStepIndex(0.999, 6)).toBe(5);
  });

  it("clamps full progress to the last step", () => {
    expect(progressToStepIndex(1, 6)).toBe(5);
    expect(progressToStepIndex(1.4, 6)).toBe(5);
  });
});

describe("beatStartFraction", () => {
  it("starts at zero and grows monotonically", () => {
    expect(beatStartFraction(0, 6)).toBe(0);
    expect(beatStartFraction(3, 6)).toBeCloseTo(0.5);
    expect(beatStartFraction(5, 6)).toBeCloseTo(5 / 6);
  });

  it("clamps out-of-range indexes", () => {
    expect(beatStartFraction(-2, 6)).toBe(0);
    expect(beatStartFraction(99, 6)).toBeCloseTo(5 / 6);
  });
});
