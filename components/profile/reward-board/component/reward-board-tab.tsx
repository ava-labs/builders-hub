import React from "react";
import { RewardCard } from "./reward-card";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { Separator } from "@/components/ui/separator";
import { Badge, UserBadge } from "@/types/badge";
import { getAllBadges } from "@/server/services/badge";
import Link from "next/link";

export default async function RewardBoardTab() {
  const session = await getAuthSession();
  const user_id = session?.user.id;
  if (!user_id) {
    return <div>Loading...</div>;
  }
  const userBadges: UserBadge[] = await getRewardBoard(user_id);
  const badges = await getAllBadges();
  
  const academyBadges = badges.filter((badge) => badge.category == "academy")?.sort((a, b) => a.id.localeCompare(b.id));
  const hackathonBadges: Badge[] = badges.filter((badge) => badge.category == "hackathon")?.sort((a, b) => a.id.localeCompare(b.id));

  const academyBadgesUnlocked = academyBadges.map((badge) => {
    const userBadge = userBadges.find((userBadge) => userBadge.badge_id == badge.id);
    
    // If there's no userBadge, check if badge has requirements
    // If no requirements, consider it unlocked by default
    if (!userBadge) {
      const hasRequirements = badge.requirements && badge.requirements.length > 0;
      return {
        ...badge,
        is_unlocked: !hasRequirements, // Unlocked if no requirements
        requirements: badge.requirements || [],
      };
    }
    
    // If userBadge exists, check if all requirements are completed
    const allRequirementsCompleted = userBadge.requirements && userBadge.requirements.length > 0 &&
      userBadge.requirements.every((requirement) => requirement.unlocked === true);
    
    // Also check if there are no requirements (should be unlocked)
    const hasNoRequirements = !userBadge.requirements || userBadge.requirements.length === 0;
    
    return {
      ...badge,
      is_unlocked: hasNoRequirements || !!allRequirementsCompleted,
      requirements: userBadge.requirements || badge.requirements || [],
    };

  }).sort((a, b) => {
    // Sort: unlocked first, then by badge_id
    if (a.is_unlocked !== b.is_unlocked) {
      return a.is_unlocked ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

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
      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-3">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Academy Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {academyRewards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href="/hackathons" className="text-blue-500 hover:text-blue-700">
              Your contributions matter. Explore our dev events here
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {academyRewards}
        </div>
      )}
    </div>
  );
}

