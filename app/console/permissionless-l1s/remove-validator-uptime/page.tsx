import { redirect, RedirectType } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/remove-validator-uptime", "Remove Validator Uptime");

export default function Page() {
  redirect("/console/remove-validator", RedirectType.replace);
}
