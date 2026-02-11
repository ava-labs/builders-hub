import { getAuthSession } from '@/lib/auth/authSession';
import ProfileForm from "@/components/profile/ProfileForm";
import { getProfile } from "@/server/services/profile";
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";
import Achievements from "@/components/profile/components/achievements";

export default async function ProfileWrapper() {
  const session = await getAuthSession();
  
  // If no session, return placeholder - AutoLoginModalTrigger will show the login modal
  if (!session?.user?.id) {
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

  const profileData = await getProfile(session.user.id);

  return (
    <UTMPreservationWrapper>
        <main className='container relative max-w-[1400px] py-4 lg:py-16 '>
        <div className='border border-zinc-300  dark:border-transparent shadow-sm dark:bg-zinc-950 bg-zinc-50 rounded-md'>

        <ProfileForm initialData={ profileData } id={session.user.id} achievements={<Achievements />} />
        </div>
        </main>
      
      
    </UTMPreservationWrapper>
  );
}
