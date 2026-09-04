import HackathonForm from "@/components/hackathons/admin-panel/HackathonForm";
import { getHackathon } from "@/server/services/hackathons";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/authSession";
import { hasPermission } from "@/lib/auth/rolePermissions";

export default async function HackathonAdminPanel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session || !hasPermission(session, { resource: "event", action: "write", scope: "own" })) {
    redirect("/");
  }

  const { id } = await params;
  const hackathon = await getHackathon(id);

  if (!hackathon) redirect("/events");

  // Ownership check: only an UNSCOPED event:manage bypasses it (platform
  // admins). team1_admin's grant is scope:"own", so it does not match here and
  // correctly falls through to the creator/cohost check below.
  const canManage = hasPermission(session, { resource: "event", action: "manage" });
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
