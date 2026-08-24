import QueryL1ValidatorSet from "@/components/toolbox/console/permissioned-l1s/query-l1-validator-set";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/validator-set", "Validator Set");

export default function Page() {
  return (
    <QueryL1ValidatorSet />
  );
}
