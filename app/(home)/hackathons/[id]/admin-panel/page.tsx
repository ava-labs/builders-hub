import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";
import TopTrafficSourcesCard from "@/components/hackathons/admin-panel/TopTrafficSourcesCard";
import { getHackathon } from "@/server/services/hackathons";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";

export default async function HackathonAdminPanel({
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
    <main className="container  relative px-2 py-4 lg:py-16 flex flex-col gap-6">
      <TopTrafficSourcesCard hackathonId={id} />
      <div className="border border-zinc-800 shadow-sm bg-zinc-950 rounded-md">
        <HackathonForm initialData={hackathon} isEditing={true} />
      </div>
    </main>
  );
}
