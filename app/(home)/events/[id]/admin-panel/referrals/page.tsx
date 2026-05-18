import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { getHackathon } from "@/server/services/hackathons";
import ReferralFunnel from "@/components/hackathons/admin-panel/sections/ReferralFunnel";

export default async function ReferralFunnelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const customAttributes: string[] = (session?.user as any)?.custom_attributes ?? [];
  if (!session || !customAttributes.includes("devrel")) {
    redirect("/");
  }

  const { id } = await params;
  const hackathon = await getHackathon(id);
  if (!hackathon) redirect("/events");

  return (
    <main className="container relative px-2 py-4 lg:py-16">
      <div className="border border-zinc-800 shadow-sm bg-zinc-950 rounded-md p-6">
        <h1 className="text-2xl font-semibold mb-1">Referral funnel</h1>
        <p className="text-sm text-zinc-400 mb-6">
          {hackathon.title} — referrals → registered → submitted → won.
        </p>
        <ReferralFunnel hackathonId={id} />
      </div>
    </main>
  );
}
