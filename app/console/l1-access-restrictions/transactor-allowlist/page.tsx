import TransactionAllowlist from "@/components/toolbox/console/l1-access-restrictions/TransactionAllowlist";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/l1-access-restrictions/transactor-allowlist");

export default function Page() {
  return (
    <TransactionAllowlist />
  );
}
