import L1NodeSetup from "@/components/toolbox/console/layer-1/AvalancheGoDockerL1";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/l1-node-setup");

export default function Page() {
  return (
    <L1NodeSetup />
  );
}
