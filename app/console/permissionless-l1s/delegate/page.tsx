import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/delegate", "Delegate");

export default function Page() {
    redirect("/console/permissionless-l1s/delegate/native");
}
