import { describe, expect, it } from "vitest";
import { KIND_LABELS } from "../../../components/validator-flow/data/message-kinds";
import { addValidatorFlow } from "../../../components/validator-flow/data/add-validator";

describe("KIND_LABELS", () => {
  it("labels every kind used by the flow data", () => {
    for (const step of addValidatorFlow.steps) {
      if (step.travel) {
        expect(KIND_LABELS[step.travel.kind]).toBeTruthy();
      }
    }
  });

  it("labels are uppercase and dash-free", () => {
    for (const label of Object.values(KIND_LABELS)) {
      expect(label).toBe(label.toUpperCase());
      expect(label).not.toMatch(/[–—]/);
    }
  });
});
