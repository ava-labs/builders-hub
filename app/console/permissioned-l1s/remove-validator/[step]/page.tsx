import { redirect, RedirectType } from "next/navigation";

// PoA's old step keys (select-subnet, initiate-removal, pchain-removal,
// complete-removal, verify-validator-set) all match the unified flow's keys.
export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  redirect(`/console/remove-validator/${step}`, RedirectType.replace);
}
