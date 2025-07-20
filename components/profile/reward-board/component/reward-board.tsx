import React from "react";
import { RewardCard } from "./reward-card";
import rewardsData from "../rewardsData";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { getLucideIcon } from "./get-lucide-icon";

export default async function RewardBoard() {
  const session = await getAuthSession();
  const user_id = session?.user.id;
  if (!user_id) {
    return <div>Loading...</div>;
  }
  const data = await getRewardBoard(user_id);
  console.log(data);
  const rewards = data.map((reward) => (
    <RewardCard
      key={reward.name}
      icon={reward.image_path}
      name={reward.name}
      description={reward.description}
      category={reward.category}
    />
  ));

  return (
    <div>
      <div className="container mx-auto py-8 flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Reward Board</h1>
          <p className="text-sm text-muted-foreground">
            View your reward board and earn rewards for your contributions.
          </p>
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {rewards}
        </div>
      </div>
    </div>
  );
}
