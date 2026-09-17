import { redirect, RedirectType } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/remove-validator-uptime", "Remove Validator Uptime");

// Same step-name remap as the force-remove route; the unified flow auto-tries
// the uptime path first so users land in the same place either way.
const STEP_REMAP: Record<string, string> = {
  "select-l1": "select-subnet",
  "pchain-weight-update": "pchain-removal",
};

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const target = STEP_REMAP[step] ?? step;
  redirect(`/console/remove-validator/${target}`, RedirectType.replace);
}
