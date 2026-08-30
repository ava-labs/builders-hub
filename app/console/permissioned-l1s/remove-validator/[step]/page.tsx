import { redirect, RedirectType } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/remove-validator", "Remove Validator");

// PoA's old step keys (select-subnet, initiate-removal, pchain-removal,
// complete-removal, verify-validator-set) all match the unified flow's keys.
export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  redirect(`/console/remove-validator/${step}`, RedirectType.replace);
}
