import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";
import { getHackathon } from "@/server/services/hackathons";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasPermission } from "@/lib/auth/roles";

export default async function HackathonAdminPanel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session || !hasPermission(session.user?.custom_attributes, { resource: "event", action: "write" })) {
    redirect("/");
  }

  const { id } = await params;
  const hackathon = await getHackathon(id);

  if (!hackathon) redirect("/events");

  // Ownership check: hackathon:manage bypasses this (devrel / superadmin).
  // Otherwise the actor must be the creator or a cohost.
  const canManage = hasPermission(session.user?.custom_attributes, { resource: "event", action: "manage" });
  if (!canManage && hackathon.created_by !== session.user?.id && !hackathon.cohosts?.includes(session.user?.email ?? "")) {
    redirect("/");
  }

  return (
    <main className="container  relative px-2 py-4 lg:py-16">
      <div className="border border-zinc-800 shadow-sm bg-zinc-950 rounded-md">
        <HackathonForm initialData={hackathon} isEditing={true} />
      </div>
    </main>
  );
}
