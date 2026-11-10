import { getAuthSession } from '@/lib/auth/authSession';
import ProfilePage from "@/components/profile/shell/ProfilePage";
import { getProfile } from "@/server/services/profile";
import { redirect } from "next/navigation";
import { formatTeamLabel } from "@/lib/referrals/team-labels";

/* The page holds no data of its own: every profile read is an API call
   that checks the session (withAuth). So the client shell renders in every
   case and asks the session itself: signed out, it shows a sign-in prompt
   (the proxy also opens the login dialog for this protected path). */
export default async function ProfileWrapper({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = await searchParams;
  const ref = resolvedSearchParams?.ref;

  if (!session?.user?.id && typeof ref === "string" && ref.trim()) {
    redirect(`/?ref=${encodeURIComponent(ref.trim())}`);
  }

  // The team label is the one server read. A user before Terms (a pending_
  // id) has no row yet, so getProfile throws: no label then.
  let teamLabel: string | null = null;
  if (session?.user?.id) {
    teamLabel = await getProfile(session.user.id)
      .then((p) => formatTeamLabel(p.team_id))
      .catch(() => null);
  }

  return (
    <main className="relative w-full">
      <ProfilePage teamLabel={teamLabel} />
    </main>
  );
}
