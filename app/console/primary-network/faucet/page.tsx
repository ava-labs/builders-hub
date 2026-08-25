import Faucet from "@/components/toolbox/console/primary-network/Faucet";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/faucet");

export default function Page() {
  return (
    <Faucet />
  );
}
