import { redirect, RedirectType } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/stake", "Stake");

export default function Page() {
  redirect("/console/add-validator", RedirectType.replace);
}
