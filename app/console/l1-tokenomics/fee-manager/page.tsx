import FeeManager from "@/components/toolbox/console/l1-tokenomics/FeeManager";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/l1-tokenomics/fee-manager");

export default function Page() {
  return (
    <FeeManager />
  );
}
