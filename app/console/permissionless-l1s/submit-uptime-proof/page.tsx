import { redirect } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/submit-uptime-proof", "Submit Uptime Proof");

export default function Page() {
    redirect("/console/permissionless-l1s/submit-uptime-proof/select-l1");
}
