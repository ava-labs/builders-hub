import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/multisig-setup", "Multisig Setup");

export default function Page() {
  redirect("/console/permissioned-l1s/multisig-setup/deploy-poa-manager");
}

