import RewardManager from "@/components/toolbox/console/l1-tokenomics/RewardManager";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/l1-tokenomics/reward-manager");

export default function Page() {
  return (
    <RewardManager />
  );
}
