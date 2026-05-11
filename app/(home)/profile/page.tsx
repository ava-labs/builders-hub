import { headers } from "next/headers";
import { getAuthSession } from '@/lib/auth/authSession';
import ProfileForm from "@/components/profile/ProfileForm";
import { getProfile } from "@/server/services/profile";
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";
import Achievements from "@/components/profile/components/achievements";
import { redirect } from "next/navigation";
import {
  buildReferralUrl,
  getActiveReferralTargets,
  listReferralLinksForUser,
} from "@/server/services/referrals";
import { ReferralLinkGenerator } from "@/components/referrals/ReferralLinkGenerator";
import { formatTeamLabel } from "@/lib/referrals/team-labels";

async function getRequestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) return "https://build.avax.network";
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export default async function ProfileWrapper({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = await searchParams;
  const ref = resolvedSearchParams?.ref;
  
  // If no session, return placeholder - AutoLoginModalTrigger will show the login modal
  if (!session?.user?.id) {
    if (typeof ref === "string" && ref.trim()) {
      redirect(`/?ref=${encodeURIComponent(ref.trim())}`);
    }

    return (
      <UTMPreservationWrapper>
        <main className='container relative max-w-[1400px] py-4 lg:py-16 '>
          <div className='border border-zinc-300 dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md'>
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading...</p>
              </div>
            </div>
          </div>
        </main>
      </UTMPreservationWrapper>
    );
  }

  const [profileData, referralLinks, referralTargets, origin] = await Promise.all([
    getProfile(session.user.id),
    listReferralLinksForUser(session.user.id),
    getActiveReferralTargets(),
    getRequestOrigin(),
  ]);

  const teamLabel = formatTeamLabel(profileData.team_id);

  const initialLinks = referralLinks.map((link) => ({
    id: link.id,
    code: link.code,
    target_type: link.target_type,
    target_id: link.target_id,
    destination_url: link.destination_url,
    created_at: link.created_at.toISOString(),
    shareUrl: buildReferralUrl(origin, link.destination_url, link.code),
  }));

  const referralPanel = (
    <ReferralLinkGenerator
      initialLinks={initialLinks}
      targets={referralTargets}
      buttonVariant="outline"
    />
  );

  return (
    <UTMPreservationWrapper>
      <main className='container relative max-w-[1400px] py-4 lg:py-16 '>
        <div className='border border-zinc-300 dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md'>
          <ProfileForm
            initialData={profileData}
            id={session.user.id}
            achievements={<Achievements />}
            referralPanel={referralPanel}
            teamLabel={teamLabel}
          />
        </div>
      </main>
    </UTMPreservationWrapper>
  );
}
