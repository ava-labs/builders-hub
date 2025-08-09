import React from "react";
import { RewardCard } from "./reward-card";
import rewardsData from "../rewardsData";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { getLucideIcon } from "./get-lucide-icon";
import { Separator } from "@/components/ui/separator";
import { UserBadge } from "@/types/badge";

export default async function RewardBoard() {
  const session = await getAuthSession();
  const user_id = session?.user.id;
  if (!user_id) {
    return <div>Loading...</div>;
  }
  const data:UserBadge[] = await getRewardBoard(user_id);
  const rewards = data.filter((reward) => reward.metadata?.type == "hackathon").map((reward) => (
    <RewardCard
      key={reward.name}
      icon={reward.image_path}
      name={reward.name}
      description={reward.description}
      category={reward.category}
      image={reward.image_path}
      className="border border-red-500 dark:bg-zinc-900"
    />
  ));
  const academyRewards = data.filter((reward) => reward.metadata?.type == "course").map((reward) => (
    <RewardCard
      key={reward.name}
      icon={reward.image_path}
      name={reward.name}
      description={reward.description}
      category={reward.category}
      image={reward.image_path}
      className="border border-gray-900 dark:bg-zinc-900"
    />
  ));

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <div>
        <div className="flex flex-col gap-4 sm:gap-6 mb-2 sm:mb-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            Hackathon Badges
          </h1>
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
