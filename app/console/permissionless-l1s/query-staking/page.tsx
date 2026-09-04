import QueryPoSValidatorSet from "@/components/toolbox/console/permissionless-l1s/QueryPoSValidatorSet";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/query-staking", "Query Staking");

export default function Page() {
  return (
    <QueryPoSValidatorSet />
  );
}
