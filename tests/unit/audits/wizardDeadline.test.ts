import { afterEach, describe, expect, it, vi } from "vitest";
import { toStoredDay } from "@/components/audits/wizard/fields/DateField";
import { wizardDefaults } from "@/components/audits/wizard/types";

/**
 * The request form's quote deadline closes at 23:59 UTC on the day picked
 * (2026-10-20, call T2), while the shared date field keeps "needed by" at the
 * start of its day.
 */

const END_OF_29TH = new Date("2026-10-29T23:59:59.999Z");

describe("the wizard's quote deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores the end of the picked UTC day, and only the needed-by date keeps its start", () => {
    // A date picker hands back local midnight of the day clicked.
    const picked = new Date(2026, 9, 29);

    expect(toStoredDay(picked, true)).toEqual(END_OF_29TH);
    expect(toStoredDay(picked, false)).toEqual(new Date("2026-10-29T00:00:00.000Z"));
  });

  it("defaults to 23:59 UTC ten days after the form opens", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T14:37:00Z"));

    const defaults = wizardDefaults({ contact_name: "Ada Stone", contact_email: "ada@nimbus.example" });

    expect(defaults.quote_deadline).toEqual(END_OF_29TH);
  });
});
