import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";
import { getHackathon } from "@/server/services/hackathons";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { canEditEvent } from "@/lib/auth/permissions";

export default async function HackathonAdminPanel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  const { id } = await params;

  // canEditEvent is the one authoritative answer to "may this user manage this
  // event": platform admin anywhere, otherwise event:write scope:"own" plus
  // creator-or-cohost. Inlining that triple here is what caused the team1_admin
  // scoping bugs, so this page asks the policy instead of re-deriving it.
  if (!(await canEditEvent(session, id))) {
    redirect("/");
  }

  const hackathon = await getHackathon(id);
  if (!hackathon) redirect("/events");

  return (
    <main className="container  relative px-2 py-4 lg:py-16">
      <div className="border border-zinc-800 shadow-sm bg-zinc-950 rounded-md">
        <HackathonForm initialData={hackathon} isEditing={true} />
      </div>
    </main>
  );
}
