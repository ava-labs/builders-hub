import React from "react";
import { RewardCard } from "./reward-card";
import { getAuthSession } from "@/lib/auth/authSession";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { Separator } from "@/components/ui/separator";
import { Badge, UserBadge } from "@/types/badge";
import { getAllBadges } from "@/server/services/badge";
import Link from "next/link";

const CONSOLE_TIER_LABELS: Record<string, string> = {
  "1": "Bronze",
  "2": "Silver",
  "3": "Gold",
  "4": "Secret",
};

const LEGENDARY_TIER = "4";

type BadgeGroup = "console" | "blockchain" | "avalanche-l1" | "entrepreneur" | "hackathon" | "unknown";

function getBadgeGroup(badge: Badge): BadgeGroup {
  const id = badge.id.toLowerCase();
  if (id.includes("console")) return "console";
  if (id.includes("blockchainacademy")) return "blockchain";
  if (id.includes("entrepreneuracademy")) return "entrepreneur";
  if (id.includes("avalanchel1academy")) return "avalanche-l1";
  if (id.includes("hackathon")) return "hackathon";
  return "unknown";
}

function getConsoleTier(badge: Badge): string {
  const id = badge.id.toLowerCase();
  // Match patterns: console-1tier, console-2tier, etc.
  const match = id.match(/(\d+)tier/);
  return match ? match[1] : "0";
}

function resolveUnlockStatus(badge: Badge, userBadges: UserBadge[]) {
  const userBadge = userBadges.find((ub) => ub.badge_id === badge.id);

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

function getBadgeOrder(badge: { id: string }): number {
  // Extract the number after the last dash-prefix, e.g. "1avalancheL1Academy-10academy-full-completion" → 10
  const match = badge.id.match(/-(\d+)/);
  return match ? Number(match[1]) : 999;
}

function sortByCourseOrder<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => getBadgeOrder(a) - getBadgeOrder(b));
}

function renderBadgeGrid(badges: ReturnType<typeof resolveUnlockStatus>[], isSecret = false) {
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
      isSecret={isSecret}
    />
  ));
}

function renderAcademySection(
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

  // Group ALL badges by ID pattern (not by category field)
  const consoleBadges: Badge[] = [];
  const blockchainBadges: Badge[] = [];
  const avalancheL1Badges: Badge[] = [];
  const entrepreneurBadges: Badge[] = [];

  for (const badge of badges) {
    const group = getBadgeGroup(badge);
    switch (group) {
      case "console": consoleBadges.push(badge); break;
      case "blockchain": blockchainBadges.push(badge); break;
      case "avalanche-l1": avalancheL1Badges.push(badge); break;
      case "entrepreneur": entrepreneurBadges.push(badge); break;
      // hackathon and unknown badges are not displayed for now
    }
  }

  // Console: group by tier
  const consoleTierMap = new Map<string, ReturnType<typeof resolveUnlockStatus>[]>();
  for (const badge of consoleBadges) {
    const tier = getConsoleTier(badge);
    const resolved = resolveUnlockStatus(badge, userBadges);
    if (!consoleTierMap.has(tier)) consoleTierMap.set(tier, []);
    consoleTierMap.get(tier)!.push(resolved);
  }
  const sortedTiers = [...consoleTierMap.keys()].sort((a, b) => Number(a) - Number(b));

  // Academy: resolve unlock status and sort
  const blockchainResolved = sortByCourseOrder(blockchainBadges.map((b) => resolveUnlockStatus(b, userBadges)));
  const avalancheL1Resolved = sortByCourseOrder(avalancheL1Badges.map((b) => resolveUnlockStatus(b, userBadges)));
  const entrepreneurResolved = sortByCourseOrder(entrepreneurBadges.map((b) => resolveUnlockStatus(b, userBadges)));

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
            const tierBadges = sortByCourseOrder(consoleTierMap.get(tier)!);
            const label = CONSOLE_TIER_LABELS[tier] || `Tier ${tier}`;
            const isLegendary = tier === LEGENDARY_TIER;
            return (
              <div key={tier}>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  {label}
                </h2>
                <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {renderBadgeGrid(tierBadges, isLegendary)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Academy Badges - grouped by sub-academy */}
      {renderAcademySection(
        "Blockchain Academy Badges",
        blockchainResolved,
        "/academy/blockchain",
        "Start the Blockchain Academy to earn badges",
      )}

      {renderAcademySection(
        "Avalanche L1 Academy Badges",
        avalancheL1Resolved,
        "/academy/avalanche-l1",
        "Start the Avalanche L1 Academy to earn badges",
      )}

      {renderAcademySection(
        "Entrepreneur Academy Badges",
        entrepreneurResolved,
        "/academy/entrepreneur",
        "Start the Entrepreneur Academy to earn badges",
      )}
    </div>
  );
}
