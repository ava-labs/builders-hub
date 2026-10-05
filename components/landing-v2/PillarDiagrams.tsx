"use client";

import PerformanceDiagram from "@/components/landing-v2/diagrams/PerformanceDiagram";
import InteropDiagram from "@/components/landing-v2/diagrams/InteropDiagram";
import PrivacyDiagram from "@/components/landing-v2/diagrams/PrivacyDiagram";
import ComplianceDiagram from "@/components/landing-v2/diagrams/ComplianceDiagram";

/* One instrument per guarantee, drawn with the diagram kit
   (components/landing-v2/diagrams/kit.tsx). `active` is false while the
   panel is collapsed: the drawing holds still and leaves the a11y tree. */
export default function PillarDiagram({ slug, active = true }: { slug: string; active?: boolean }) {
  switch (slug) {
    case "performance":
      return <PerformanceDiagram active={active} />;
    case "interoperability":
      return <InteropDiagram active={active} />;
    case "privacy":
      return <PrivacyDiagram active={active} />;
    case "compliance":
      return <ComplianceDiagram active={active} />;
    default:
      return null;
  }
}
