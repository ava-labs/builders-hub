import { redirect, RedirectType } from "next/navigation";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissionless-l1s/stake", "Stake");

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  redirect(`/console/add-validator/${step}`, RedirectType.replace);
}
