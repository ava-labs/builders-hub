import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { dateFields } = vi.hoisted(() => ({ dateFields: [] as Array<Record<string, unknown>> }));
// The shared date field is tested in wizardDeadline.test.ts; this file reads
// which of the step's two dates asks it for the end of the day.
vi.mock("@/components/audits/wizard/fields/DateField", () => ({
  DateField: (props: Record<string, unknown>) => {
    dateFields.push(props);
    return null;
  },
}));

import { AuditWizardProvider } from "@/components/audits/wizard/AuditWizardContext";
import { StepTimeline } from "@/components/audits/wizard/StepTimeline";

describe("the request form's timeline step", () => {
  it("stores the quote deadline at the end of its day and needed by at its start", () => {
    const prefill = { contact_name: "Ada Stone", contact_email: "ada@nimbus.example" };
    renderToStaticMarkup(
      createElement(AuditWizardProvider, { initialDraft: null, prefill, firms: [] }, createElement(StepTimeline)),
    );

    const byName = Object.fromEntries(dateFields.map((props) => [props.name, props]));
    expect(byName.quote_deadline?.endOfDay).toBe(true);
    expect(byName.needed_by?.endOfDay).toBeFalsy();
  });
});
