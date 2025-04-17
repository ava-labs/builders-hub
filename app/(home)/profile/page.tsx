import { SessionProvider } from 'next-auth/react';
import { getAuthSession } from '@/lib/auth/authSession';
import ProfileForm from "@/components/profile/ProfileForm";
import { Profile } from '@/types/profile';
import { getProfile } from "@/server/services/profile";

export default async function ProfileWrapper() {
  const session = await getAuthSession();
  const profileData = await getProfile(session!.user.email!);

  return (
    <ProfileForm initialData={ profileData }/>
  );
}
