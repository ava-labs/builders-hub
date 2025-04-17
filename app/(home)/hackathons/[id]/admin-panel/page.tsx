import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";
import { getHackathon } from "@/server/services/hackathons";
import { redirect } from "next/navigation";

export default async function HackathonAdminPanel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hackathon = await getHackathon(id);

  if (!hackathon) redirect("/hackathons");

  return (
    <main className="container  relative px-2 py-4 lg:py-16">
      <div className="border border-zinc-800 shadow-sm bg-zinc-950 rounded-md">
        <HackathonForm initialData={hackathon} isEditing={true} />
      </div>
    </main>
  );
}
