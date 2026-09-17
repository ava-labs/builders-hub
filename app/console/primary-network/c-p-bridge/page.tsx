import Bridge from "@/components/toolbox/console/primary-network/CrossChainTransfer";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/c-p-bridge");

export default function Page() {
  return (
    <Bridge />
  );
}
