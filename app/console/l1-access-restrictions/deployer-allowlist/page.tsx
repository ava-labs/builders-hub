import DeployerAllowlist from "@/components/toolbox/console/l1-access-restrictions/DeployerAllowlist";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/l1-access-restrictions/deployer-allowlist");

export default function Page() {
  return (
    <DeployerAllowlist />
  );
}
