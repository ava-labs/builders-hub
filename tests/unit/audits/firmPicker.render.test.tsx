import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FirmPicker } from "@/components/audits/wizard/FirmPicker";
import type { PublicFirm } from "@/server/services/audits/visibility";

const firms16: PublicFirm[] = Array.from({ length: 16 }, (_, i) => ({
  id: `f${i}`,
  firm_name: `Firm ${i}`,
  services: i < 8 ? ["OpSec"] : [],
  website: null,
  logo_url: null,
}));
const firmsBare: PublicFirm[] = firms16.map((f) => ({ ...f, services: [] }));

const noop = () => {};

const render = (props: {
  firms?: PublicFirm[];
  value: string[];
  neededServices?: string[];
  defaultOpen?: boolean;
}) =>
  renderToStaticMarkup(
    createElement(FirmPicker, {
      firms: props.firms ?? firms16,
      neededServices: props.neededServices ?? ["OpSec"],
      value: props.value,
      onChange: noop,
      defaultOpen: props.defaultOpen ?? false,
    }),
  );

describe("FirmPicker", () => {
  it("collapsed default reads the firm count", () => {
    expect(render({ value: [] })).toContain("All 16 vetted firms");
  });

  it("collapsed narrowed reads N of total with names", () => {
    const html = render({ value: ["f0", "f1"] });
    expect(html).toContain("2 of 16 vetted firms");
    expect(html).toContain("Firm 0, Firm 1");
  });

  it("neither counts nor names a stored id absent from the list", () => {
    const html = render({ value: ["f0", "zzz"] });
    expect(html).toContain("1 of 16 vetted firms");
    expect(html).toContain("Firm 0");
    expect(html).not.toContain("zzz");
  });

  it("shows the all-gone state when no chosen id resolves", () => {
    const html = render({ value: ["zzz"] });
    expect(html).toContain("0 of 16 vetted firms");
    expect(html).toContain("the firms you chose are no longer listed");
  });

  it("warns in the singular and the plural at 1 or 2 picked (open)", () => {
    expect(render({ value: ["f0"], defaultOpen: true })).toContain(
      "Only 1 firm will see this request.",
    );
    expect(render({ value: ["f0", "f1"], defaultOpen: true })).toContain(
      "Only 2 firms will see this request.",
    );
  });

  it("shows the day-one line when no firm has listed services (open)", () => {
    const html = render({ firms: firmsBare, value: [], defaultOpen: true });
    expect(html).toContain("listed their services yet");
    expect(html).toContain("pick by name");
  });

  it("quick-pick chip is dashed when its group is partly picked, solid when fully picked (open)", () => {
    // Four firms so ChipGroup never collapses (its "N more" button is dashed
    // too); any border-dashed then comes only from a partial quick-pick chip.
    const firms4: PublicFirm[] = [
      { id: "m1", firm_name: "Match One", services: ["OpSec"], website: null, logo_url: null },
      { id: "m2", firm_name: "Match Two", services: ["OpSec"], website: null, logo_url: null },
      { id: "u1", firm_name: "Unlisted One", services: [], website: null, logo_url: null },
      { id: "u2", firm_name: "Unlisted Two", services: [], website: null, logo_url: null },
    ];
    const partial = render({ firms: firms4, value: ["m1"], defaultOpen: true });
    expect(partial).toContain("border-dashed");
    const full = render({ firms: firms4, value: ["m1", "m2"], defaultOpen: true });
    expect(full).not.toContain("border-dashed");
    expect(full).toContain('aria-pressed="true"');
  });
});
