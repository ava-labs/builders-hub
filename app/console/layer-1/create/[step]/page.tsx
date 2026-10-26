import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/create");

/**
 * The flow renders in ../layout.tsx, above this route, so it stays mounted from step to step (con-step-travel). This
 * page marks the top of the flow: on a step change Next scrolls the marker into view, as it scrolled the flow when this
 * page rendered it, so Next at the foot of a long step brings the step bar back on screen.
 */
export default function Page() {
  return <div aria-hidden data-step-route />;
}
