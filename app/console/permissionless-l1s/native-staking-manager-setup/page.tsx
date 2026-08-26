import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/native-staking-manager-setup", "Native Staking Manager Setup");

export default function Page() {
  redirect("/console/permissionless-l1s/native-staking-manager-setup/deploy");
}
