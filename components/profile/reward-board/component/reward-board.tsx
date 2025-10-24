
import React from "react";
import { RewardCard } from "./reward-card";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { Separator } from "@/components/ui/separator";
import { Badge, UserBadge } from "@/types/badge";
import { getAllBadges } from "@/server/services/badge";

export default async function RewardBoard() {
  const session = await getAuthSession();
  const user_id = session?.user.id;
  if (!user_id) {
    return <div>Loading...</div>;
  }
  const userBadges:UserBadge[] = await getRewardBoard(user_id);
  const badges = await getAllBadges();
  const academyBadges = badges.filter((badge) => badge.category == "academy");
  const hackathonBadges:Badge[] = badges.filter((badge) => badge.category == "hackathon");
  const totalPoints = userBadges.reduce((acc, userBadge) => acc + userBadge.points, 0);
  const hackathonBadgesUnlocked = hackathonBadges.map((badge) => {
    const userBadge = userBadges.find((userBadge) => userBadge.badge_id == badge.id);
    return {
      ...badge,
      is_unlocked: !!userBadge,
      requirements: userBadge?.requirements || badge.requirements,
    };
  }).sort(element=>element.is_unlocked ? -1 : 1);
  
  const academyBadgesUnlocked = academyBadges.map((badge) => {
    const userBadge = userBadges.find((userBadge) => userBadge.badge_id == badge.id);
    return {
      ...badge,
      is_unlocked: !!userBadge,
      requirements: userBadge?.requirements || badge.requirements,
    };
  }).sort(element=>element.is_unlocked ? -1 : 1);
  const rewards = hackathonBadgesUnlocked.map((reward) => (
    <RewardCard
      key={reward.name}
      icon={reward.image_path}
      name={reward.name}
      description={reward.description}
      category={reward.category}
      is_unlocked={reward.is_unlocked}
      image={reward.image_path}
      requirements={reward.requirements}
      id={reward.id}

    />
  ));
  const academyRewards = academyBadgesUnlocked.map((reward) => (
    
    <RewardCard
      key={reward.name}
      icon={reward.image_path}
      name={reward.name}
      description={reward.description}
      category={reward.category}
      image={reward.image_path}
      requirements={reward.requirements}
      id={reward.id}
      is_unlocked={reward.is_unlocked}
  
    />
  ));

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div>
  

        <div className="flex flex-col gap-4 sm:gap-6 mb-2 sm:mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
              Hackathon Badges
            </h1>
            <div className="px-4 py-2 border rounded border-red-500 ">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Total Points: {totalPoints}
              </h2>
            </div>
          </div>
        </div>
        <Separator className="mb-6 mt-6 bg-zinc-700 " />
        {rewards.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 text-lg">
              No rewards available yet. Keep contributing to earn rewards!
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {rewards}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-8 ">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Academy Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700 " />
      {academyRewards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
          Your contributions matter. Keep going to start earning rewards!
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {academyRewards}
        </div>
      )}
    </div>
  );
}
