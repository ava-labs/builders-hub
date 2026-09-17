import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/remove-delegation", "Remove Delegation");

export default function Page() {
    redirect("/console/permissionless-l1s/remove-delegation/select-l1");
}
