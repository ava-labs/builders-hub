import {
  Alternatives,
  Control,
  Cta,
  Header,
  Hero,
  Mechanism,
  PageFooter,
  Summary,
  Visibility,
} from "./_besu/sections";

/**
 * Besu connection landing page.
 *
 * Recreated from the design handoff at
 * ~/workspaces/technical/besu-to-avalanche/design/landing_design_handoff_besu_connection/
 *
 * Fidelity is HIGH by instruction: colours, type, spacing and copy are final
 * and approved. Every part of the page lives in ./_besu so it can be lifted to
 * another site without unpicking Builder Hub dependencies. See
 * ./_besu/README.md.
 *
 * This file stays a bare composition on purpose. Section order is the page.
 */
export default function BesuConnectionPage() {
  return (
    <>
      <Header />
      <Hero />
      <Summary />
      <Mechanism />
      <Control />
      <Visibility />
      <Alternatives />
      <Cta />
      <PageFooter />
    </>
  );
}
