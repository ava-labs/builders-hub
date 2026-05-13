import { redirect, RedirectType } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  redirect(`/console/add-validator/${step}`, RedirectType.replace);
}
