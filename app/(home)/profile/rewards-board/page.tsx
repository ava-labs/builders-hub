import { getAuthSession } from '@/lib/auth/authSession';
import ProfileForm from "@/components/profile/ProfileForm";
import { getProfile } from "@/server/services/profile";
import RewardBoard from '@/components/profile/reward-board/component/reward-board';

export default async function RewardsBoardWrapper() {
  const session = await getAuthSession();
  const profileData = await getProfile(session!.user.id!);

  return (
    <div>
      <RewardBoard/>
    </div>
  );
}
