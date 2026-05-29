import { getAuthSession } from '@/lib/auth/authSession';
import ProfilePage from "@/components/profile/shell/ProfilePage";
import { getProfile } from "@/server/services/profile";
import { redirect } from "next/navigation";
import { formatTeamLabel } from "@/lib/referrals/team-labels";

export default async function ProfileWrapper({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = await searchParams;
  const ref = resolvedSearchParams?.ref;
  
  if (!session?.user?.id) {
    if (typeof ref === "string" && ref.trim()) {
      redirect(`/?ref=${encodeURIComponent(ref.trim())}`);
    }

    return (
      <main className='relative w-full px-4 sm:px-6 lg:px-8 py-2 lg:py-4'>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  const profileData = await getProfile(session.user.id);
  const teamLabel = formatTeamLabel(profileData.team_id);

  return (
    <main className='relative w-full px-4 sm:px-6 lg:px-8 py-2 lg:py-4'>
      <ProfilePage teamLabel={teamLabel} />
    </main>
  );
}
