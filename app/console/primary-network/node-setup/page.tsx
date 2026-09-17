import PrimaryNetworkNodeSetup from "@/components/toolbox/console/primary-network/AvalancheGoDockerPrimaryNetwork";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/node-setup");

export default function Page() {
  return (
    <PrimaryNetworkNodeSetup />
  );
}
