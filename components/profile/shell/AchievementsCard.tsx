"use client";

import * as React from "react";
import type { Requirement } from "@/types/badge";
import { SparkleIcon } from "./icons";

type AchievementGroup =
  | "console"
  | "blockchain"
  | "avalanche-l1"
  | "entrepreneur"
  | "hackathon"
  | "unknown";

export interface AchievementsCardBadge {
  id: string;
  badgeId: string;
  name: string;
  description: string;
  imagePath: string;
  category: string;
  group: AchievementGroup;
  tier: string | null;
  isUnlocked: boolean;
  isSecret: boolean;
  awardedAt: string | null;
  requirements: Requirement[];
}

interface Props {
  badges: AchievementsCardBadge[];
  loading?: boolean;
}

const CATEGORY_ACCENT: Record<string, string> = {
  hackathon: "pr-red",
  academy: "pr-gold",
  console: "pr-indigo",
  social: "pr-green",
};

function accentFor(category: string): string {
  return CATEGORY_ACCENT[category.toLowerCase()] ?? "pr-dark";
}

const CONSOLE_TIER_LABELS: Record<string, string> = {
  "1": "Bronze",
  "2": "Silver",
  "3": "Gold",
  "4": "Secret",
};

const GROUP_LABELS: Record<AchievementGroup, string> = {
  console: "Console Badges",
  blockchain: "Blockchain Academy Badges",
  "avalanche-l1": "Avalanche L1 Academy Badges",
  entrepreneur: "Entrepreneur Academy Badges",
  hackathon: "Hackathon Badges",
  unknown: "Other Badges",
};

const GROUP_ORDER: AchievementGroup[] = [
  "console",
  "blockchain",
  "avalanche-l1",
  "entrepreneur",
];

function countUnlocked(badges: AchievementsCardBadge[]): number {
  return badges.filter((badge) => badge.isUnlocked).length;
}

function getGroupedBadges(badges: AchievementsCardBadge[]) {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    badges: badges.filter((badge) => badge.group === group),
  })).filter((section) => section.badges.length > 0);
}

function tierSortKey(tier: string | null): number {
  return Number(tier ?? 0);
}

function BadgeTile({ badge }: { badge: AchievementsCardBadge }) {
  const secretLocked = badge.isSecret && !badge.isUnlocked;
  const requirementsDone = badge.requirements.filter((requirement) => requirement.unlocked).length;
  const requirementsTotal = badge.requirements.length;
  const progressLabel =
    requirementsTotal > 0
      ? `${requirementsDone}/${requirementsTotal} requirements`
      : badge.isUnlocked
        ? "Unlocked"
        : "Locked";

  return (
    <div
      className={`pr-badge ${accentFor(badge.category)} ${
        badge.isUnlocked ? "pr-unlocked" : "pr-locked"
      }`}
      title={secretLocked ? "Secret badge" : badge.description}
    >
      <span
        className="pr-glyph"
        style={{ background: "var(--pr-g-200)" }}
      >
        {secretLocked ? (
          <span className="pr-badge__secret">?</span>
        ) : badge.imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={badge.imagePath} alt="" width={96} height={96} />
        ) : (
          <SparkleIcon size={36} />
        )}
      </span>
      <span className="pr-nm">{secretLocked ? "Secret badge" : badge.name}</span>
      <span className="pr-lvl">{progressLabel}</span>
    </div>
  );
}

export function AchievementsCard({ badges, loading = false }: Props) {
  const unlockedCount = countUnlocked(badges);
  const groupedBadges = getGroupedBadges(badges);

  return (
    <div className="pr-card">
      <div className="pr-head">
        <div
          className="pr-ico"
          style={{ background: "var(--pr-primary-light)", color: "var(--pr-accent-main)" }}
        >
          <SparkleIcon size={18} />
        </div>
        <div>
          <h3>Achievements</h3>
          <div className="pr-desc">
            {loading
              ? "Loading achievements..."
              : badges.length === 0
                ? "Earn badges by participating in hackathons, academies, and Builder Hub events."
                : `${unlockedCount} unlocked of ${badges.length} available.`}
          </div>
        </div>
      </div>
      <div className="pr-body">
        {loading ? (
          <div className="pr-badge-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="pr-badge"
                style={{ opacity: 0.35, pointerEvents: "none" }}
                aria-hidden
              >
                <span
                  className="pr-glyph"
                  style={{ background: "var(--pr-g-300)" }}
                />
                <span className="pr-nm">&nbsp;</span>
                <span className="pr-lvl">&nbsp;</span>
              </div>
            ))}
          </div>
        ) : groupedBadges.length === 0 ? (
          <div className="pr-empty">No badges yet.</div>
        ) : (
          <div className="pr-achievements">
            {groupedBadges.map((section) => (
              <section key={section.group} className="pr-achievement-group">
                <header className="pr-achievement-group__head">
                  <h4>{section.label}</h4>
                  <span>
                    {countUnlocked(section.badges)} / {section.badges.length} unlocked
                  </span>
                </header>

                {section.group === "console" ? (
                  <div className="pr-achievement-tiers">
                    {[...new Set(section.badges.map((badge) => badge.tier ?? "0"))]
                      .sort((a, b) => tierSortKey(a) - tierSortKey(b))
                      .map((tier) => {
                        const tierBadges = section.badges.filter(
                          (badge) => (badge.tier ?? "0") === tier,
                        );
                        return (
                          <div key={tier} className="pr-achievement-tier">
                            <div className="pr-achievement-tier__label">
                              {CONSOLE_TIER_LABELS[tier] ?? `Tier ${tier}`}
                            </div>
                            <div className="pr-badge-grid">
                              {tierBadges.map((badge) => (
                                <BadgeTile key={badge.id} badge={badge} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="pr-badge-grid">
                    {section.badges.map((badge) => (
                      <BadgeTile key={badge.id} badge={badge} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
