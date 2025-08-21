import { getAuthSession } from '@/lib/auth/authSession';
import ProfileForm from "@/components/profile/ProfileForm";
import { getProfile } from "@/server/services/profile";
import UTMPreservationWrapper from "@/components/hackathons/UTMPreservationWrapper";

export default async function ProfileWrapper() {
  const session = await getAuthSession();
  const profileData = await getProfile(session!.user.id!);

  return (
    <UTMPreservationWrapper>
      <ProfileForm initialData={ profileData } id={session!.user.id!}/>
    </UTMPreservationWrapper>
  );
}
