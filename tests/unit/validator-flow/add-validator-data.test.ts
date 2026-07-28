import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addValidatorFlow } from "../../../components/validator-flow/data/add-validator";
import { desktopLayout, mobileLayout } from "../../../components/validator-flow/stage-layouts";

const actorIds = new Set(addValidatorFlow.actors.map((a) => a.id));

describe("add-validator flow data integrity", () => {
  it("has six steps with unique ids", () => {
    expect(addValidatorFlow.steps).toHaveLength(6);
    expect(new Set(addValidatorFlow.steps.map((s) => s.id)).size).toBe(6);
  });

  it("references only known actors", () => {
    for (const step of addValidatorFlow.steps) {
      for (const a of step.activeActors) {
        expect(actorIds.has(a)).toBe(true);
      }
      if (step.travel) {
        expect(actorIds.has(step.travel.from)).toBe(true);
        expect(actorIds.has(step.travel.to)).toBe(true);
      }
    }
  });

  it("uses 4-byte hex error selectors when present", () => {
    for (const step of addValidatorFlow.steps) {
      for (const f of step.failureModes) {
        if (f.errorSelector) {
          expect(f.errorSelector).toMatch(/^0x[0-9a-f]{8}$/);
        }
      }
    }
  });

  it("deep-links only to real console add-validator steps", () => {
    const src = readFileSync(
      join(process.cwd(), "app/console/add-validator/steps.ts"),
      "utf8",
    );
    for (const step of addValidatorFlow.steps) {
      const href = step.operator.consoleHref;
      if (!href) continue;
      expect(href.startsWith("/console/add-validator/")).toBe(true);
      const key = href.split("/").pop() as string;
      expect(src.includes(`"${key}"`) || src.includes(`'${key}'`)).toBe(true);
    }
  });

  it("covers every actor in both stage layouts", () => {
    for (const actor of addValidatorFlow.actors) {
      expect(desktopLayout.actors[actor.id]).toBeDefined();
      expect(mobileLayout.actors[actor.id]).toBeDefined();
    }
  });

  it("gives every step a rail label that fits a cell", () => {
    for (const step of addValidatorFlow.steps) {
      expect(step.railLabel.length).toBeGreaterThan(0);
      expect(step.railLabel.length).toBeLessThanOrEqual(14);
      expect(step.railLabel).toMatch(/^[A-Z0-9 -]+$/);
    }
  });

  it("carries hero copy", () => {
    expect(addValidatorFlow.heroTitle.length).toBeGreaterThan(0);
  });

  it("points sdk references at the sdk repository", () => {
    const refs = addValidatorFlow.steps.flatMap((step) => step.operator.sdkRefs ?? []);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.label.length).toBeGreaterThan(0);
      expect(ref.href).toMatch(/^https:\/\/github\.com\/ava-labs\/avalanche-sdk-typescript\//);
    }
  });
});
