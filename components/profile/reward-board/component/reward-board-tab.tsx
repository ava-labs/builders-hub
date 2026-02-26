import React from "react";
import { RewardCard } from "./reward-card";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { Separator } from "@/components/ui/separator";
import { Badge, UserBadge } from "@/types/badge";
import { getAllBadges } from "@/server/services/badge";
import Link from "next/link";

function getAcademySubcategory(badge: Badge): "blockchain" | "avalanche-l1" | "entrepreneur" {
  if (badge.id.includes("blockchainAcademy")) return "blockchain";
  if (badge.id.includes("entrepreneurAcademy")) return "entrepreneur";
  return "avalanche-l1";
}

function resolveUnlockStatus(badge: Badge, userBadges: UserBadge[]) {
  const userBadge = userBadges.find((ub) => ub.badge_id == badge.id);

  if (!userBadge) {
    const hasRequirements = badge.requirements && badge.requirements.length > 0;
    return {
      ...badge,
      is_unlocked: !hasRequirements,
      requirements: badge.requirements || [],
    };
  }

  const allRequirementsCompleted = userBadge.requirements && userBadge.requirements.length > 0 &&
    userBadge.requirements.every((requirement) => requirement.unlocked === true);
  const hasNoRequirements = !userBadge.requirements || userBadge.requirements.length === 0;

  return {
    ...badge,
    is_unlocked: hasNoRequirements || !!allRequirementsCompleted,
    requirements: userBadge.requirements || badge.requirements || [],
  };
}

function sortUnlockedFirst<T extends { is_unlocked: boolean; name: string }>(items: T[]): T[] {
  return items.sort((a, b) => {
    if (a.is_unlocked !== b.is_unlocked) return a.is_unlocked ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function renderBadgeGrid(badges: ReturnType<typeof resolveUnlockStatus>[]) {
  return badges.map((reward) => (
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
}

export default async function RewardBoardTab() {
  const session = await getAuthSession();
  const user_id = session?.user.id;
  if (!user_id) {
    return <div>Loading...</div>;
  }
  const userBadges: UserBadge[] = await getRewardBoard(user_id);
  const badges = await getAllBadges();

  const consoleBadges = badges.filter((badge) => badge.category == "console")?.sort((a, b) => a.id.localeCompare(b.id));
  const academyBadges = badges.filter((badge) => badge.category == "academy")?.sort((a, b) => a.id.localeCompare(b.id));

  const consoleResolved = sortUnlockedFirst(consoleBadges.map((b) => resolveUnlockStatus(b, userBadges)));

  const blockchainBadges = sortUnlockedFirst(
    academyBadges.filter((b) => getAcademySubcategory(b) === "blockchain").map((b) => resolveUnlockStatus(b, userBadges))
  );
  const avalancheL1Badges = sortUnlockedFirst(
    academyBadges.filter((b) => getAcademySubcategory(b) === "avalanche-l1").map((b) => resolveUnlockStatus(b, userBadges))
  );
  const entrepreneurBadges = sortUnlockedFirst(
    academyBadges.filter((b) => getAcademySubcategory(b) === "entrepreneur").map((b) => resolveUnlockStatus(b, userBadges))
  );

  const consoleRewards = renderBadgeGrid(consoleResolved);
  const blockchainRewards = renderBadgeGrid(blockchainBadges);
  const avalancheL1Rewards = renderBadgeGrid(avalancheL1Badges);
  const entrepreneurRewards = renderBadgeGrid(entrepreneurBadges);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-3">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Console Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {consoleRewards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href="/tools" className="text-blue-500 hover:text-blue-700">
              Start building on the console to earn badges
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {consoleRewards}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Blockchain Academy Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {blockchainRewards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href="/academy/blockchain" className="text-blue-500 hover:text-blue-700">
              Start the Blockchain Academy to earn badges
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {blockchainRewards}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Avalanche L1 Academy Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {avalancheL1Rewards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href="/academy/avalanche-l1" className="text-blue-500 hover:text-blue-700">
              Start the Avalanche L1 Academy to earn badges
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {avalancheL1Rewards}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Entrepreneur Academy Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {entrepreneurRewards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href="/academy/entrepreneur" className="text-blue-500 hover:text-blue-700">
              Start the Entrepreneur Academy to earn badges
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {entrepreneurRewards}
        </div>
      )}
    </div>
  );
}
