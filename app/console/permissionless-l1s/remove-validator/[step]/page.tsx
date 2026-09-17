import { redirect, RedirectType } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/remove-validator", "Remove Validator");

// PoS force-remove step keys: select-l1, initiate-removal, pchain-weight-update,
// complete-removal, claim-fees, verify-validator-set. Remap differing names.
const STEP_REMAP: Record<string, string> = {
  "select-l1": "select-subnet",
  "pchain-weight-update": "pchain-removal",
};

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const target = STEP_REMAP[step] ?? step;
  redirect(`/console/remove-validator/${target}`, RedirectType.replace);
}
