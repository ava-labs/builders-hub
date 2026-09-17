import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/staking-manager-setup", "Staking Manager Setup");

export default async function Page() {
    redirect("/console/permissionless-l1s/native-staking-manager-setup");
}
