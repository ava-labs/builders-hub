import React from "react";
import { RewardCard } from "./reward-card";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { Separator } from "@/components/ui/separator";
import { Badge, UserBadge } from "@/types/badge";
import { getAllBadges } from "@/server/services/badge";
import Link from "next/link";

const TIER_LABELS: Record<string, string> = {
  "1": "Bronze",
  "2": "Silver",
  "3": "Gold",
  "4": "Secret",
};

function getAcademySubcategory(badge: Badge): "blockchain" | "avalanche-l1" | "entrepreneur" {
  const idLower = badge.id.toLowerCase();
  if (idLower.includes("blockchainacademy")) return "blockchain";
  if (idLower.includes("entrepreneuracademy")) return "entrepreneur";
  if (idLower.includes("avalanchel1academy")) return "avalanche-l1";
  return "avalanche-l1";
}

function getConsoleTier(badge: Badge): string {
  const match = badge.id.match(/console-(\d+)tier/i);
  return match ? match[1] : "0";
}

function resolveUnlockStatus(badge: Badge, userBadges: UserBadge[]) {
  const userBadge = userBadges.find((ub) => ub.badge_id == badge.id);

  if (!userBadge) {
    return {
      ...badge,
      is_unlocked: false,
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
  return [...items].sort((a, b) => {
    if (a.is_unlocked !== b.is_unlocked) return a.is_unlocked ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function renderBadgeGrid(badges: ReturnType<typeof resolveUnlockStatus>[]) {
  return badges.map((reward) => (
    <RewardCard
      key={reward.id}
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

function renderBadgeSection(
  title: string,
  badges: ReturnType<typeof resolveUnlockStatus>[],
  emptyLink: string,
  emptyText: string,
) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {badges.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href={emptyLink} className="text-blue-500 hover:text-blue-700">
              {emptyText}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {renderBadgeGrid(badges)}
        </div>
      )}
    </>
  );
}

export default async function RewardBoardTab() {
  const session = await getAuthSession();
  const user_id = session?.user.id;
  if (!user_id) {
    return <div>Loading...</div>;
  }
  const userBadges: UserBadge[] = await getRewardBoard(user_id);
  const badges = await getAllBadges();

  // Split by category
  const consoleBadges = badges.filter((b) => b.category === "console").sort((a, b) => a.id.localeCompare(b.id));
  const academyBadges = badges.filter((b) => b.category === "academy").sort((a, b) => a.id.localeCompare(b.id));

  // Console: group by tier
  const consoleTierMap = new Map<string, ReturnType<typeof resolveUnlockStatus>[]>();
  for (const badge of consoleBadges) {
    const tier = getConsoleTier(badge);
    const resolved = resolveUnlockStatus(badge, userBadges);
    if (!consoleTierMap.has(tier)) consoleTierMap.set(tier, []);
    consoleTierMap.get(tier)!.push(resolved);
  }
  const sortedTiers = [...consoleTierMap.keys()].sort((a, b) => Number(a) - Number(b));

  // Academy: group by sub-academy
  const blockchainBadges = sortUnlockedFirst(
    academyBadges.filter((b) => getAcademySubcategory(b) === "blockchain").map((b) => resolveUnlockStatus(b, userBadges))
  );
  const avalancheL1Badges = sortUnlockedFirst(
    academyBadges.filter((b) => getAcademySubcategory(b) === "avalanche-l1").map((b) => resolveUnlockStatus(b, userBadges))
  );
  const entrepreneurBadges = sortUnlockedFirst(
    academyBadges.filter((b) => getAcademySubcategory(b) === "entrepreneur").map((b) => resolveUnlockStatus(b, userBadges))
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Console Badges - grouped by tier */}
      <div className="flex flex-col gap-4 sm:gap-6 mb-2 mt-3">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
          Console Badges
        </h1>
      </div>
      <Separator className="mb-6 mt-6 bg-zinc-700" />
      {sortedTiers.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            <Link href="/tools" className="text-blue-500 hover:text-blue-700">
              Start building on the console to earn badges
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {sortedTiers.map((tier) => {
            const tierBadges = sortUnlockedFirst(consoleTierMap.get(tier)!);
            const label = TIER_LABELS[tier] || `Tier ${tier}`;
            return (
              <div key={tier}>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  {label}
                </h2>
                <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {renderBadgeGrid(tierBadges)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Academy Badges - grouped by sub-academy */}
      {renderBadgeSection(
        "Blockchain Academy Badges",
        blockchainBadges,
        "/academy/blockchain",
        "Start the Blockchain Academy to earn badges",
      )}

      {renderBadgeSection(
        "Avalanche L1 Academy Badges",
        avalancheL1Badges,
        "/academy/avalanche-l1",
        "Start the Avalanche L1 Academy to earn badges",
      )}

      {renderBadgeSection(
        "Entrepreneur Academy Badges",
        entrepreneurBadges,
        "/academy/entrepreneur",
        "Start the Entrepreneur Academy to earn badges",
      )}
    </div>
  );
}
