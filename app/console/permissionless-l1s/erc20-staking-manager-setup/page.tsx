import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/erc20-staking-manager-setup", "ERC-20 Staking Manager Setup");

export default function Page() {
  redirect("/console/permissionless-l1s/erc20-staking-manager-setup/deploy-erc20-token");
}
