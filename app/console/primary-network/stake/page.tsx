import Stake from "@/components/toolbox/console/primary-network/Stake";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/stake", "Stake AVAX");

export default function Page() {
  return (
    <Stake />
  );
}
