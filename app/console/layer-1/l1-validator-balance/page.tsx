import L1ValidatorBalance from "@/components/toolbox/console/layer-1/BalanceTopup";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/l1-validator-balance", "Validator Balance");

export default function Page() {
  return (
    <L1ValidatorBalance />
  );
}
