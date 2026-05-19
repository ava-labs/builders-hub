"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function BadgeTile({
  badge,
  onOpen,
}: {
  badge: AchievementsCardBadge;
  onOpen: (badge: AchievementsCardBadge) => void;
}) {
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
    <button
      type="button"
      onClick={() => {
        // Secret-locked badges have nothing to reveal — keep the tile static.
        if (secretLocked) return;
        onOpen(badge);
      }}
      className={`pr-badge ${accentFor(badge.category)} ${
        badge.isUnlocked ? "pr-unlocked" : "pr-locked"
      }`}
      style={{
        cursor: secretLocked ? "default" : "pointer",
        font: "inherit",
        color: "inherit",
        background: "transparent",
        textAlign: "center",
      }}
      title={secretLocked ? "Secret badge" : badge.description}
      aria-label={
        secretLocked
          ? "Secret badge — keep building to reveal"
          : `${badge.name} — ${badge.isUnlocked ? "unlocked" : "locked"}. Click to view requirements`
      }
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
    </button>
  );
}

function requirementSummary(req: Requirement): string {
  if (req.description) return req.description;
  if (req.type === "hackathon" && req.hackathon) {
    const verb =
      req.hackathon === "won"
        ? "Win a hackathon"
        : req.hackathon === "register"
          ? "Register for a hackathon"
          : "Submit a project to a hackathon";
    return verb;
  }
  if (req.type === "course" && req.course_id) {
    return `Complete the ${req.course_id} course`;
  }
  return "Complete a Builder Hub milestone";
}

function BadgeDetailsDialog({
  badge,
  onClose,
}: {
  badge: AchievementsCardBadge | null;
  onClose: () => void;
}) {
  const open = badge !== null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        {badge && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span
                  className={`pr-glyph ${accentFor(badge.category)}`}
                  style={{
                    width: 64,
                    height: 64,
                    flexShrink: 0,
                    background: "var(--pr-g-200)",
                    filter: badge.isUnlocked ? undefined : "grayscale(1)",
                    opacity: badge.isUnlocked ? 1 : 0.7,
                  }}
                >
                  {badge.imagePath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={badge.imagePath} alt="" width={64} height={64} />
                  ) : (
                    <SparkleIcon size={24} />
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <DialogTitle>{badge.name}</DialogTitle>
                  <DialogDescription>
                    {badge.isUnlocked ? "Unlocked" : "Locked — see how to earn it below"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            {badge.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                {badge.description}
              </p>
            )}
            {badge.requirements.length > 0 ? (
              <div className="mt-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                  How to earn this badge
                </div>
                <ul className="flex flex-col gap-2">
                  {badge.requirements.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span
                        className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${
                          req.unlocked
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                        aria-hidden
                      >
                        {req.unlocked ? <Check size={12} /> : <Lock size={11} />}
                      </span>
                      <span
                        className={
                          req.unlocked
                            ? "text-zinc-700 dark:text-zinc-200"
                            : "text-zinc-600 dark:text-zinc-300"
                        }
                      >
                        {requirementSummary(req)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                {badge.isUnlocked
                  ? "Awarded for participating in Builder Hub."
                  : "Keep exploring Builder Hub to unlock this badge."}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AchievementsCard({ badges, loading = false }: Props) {
  const unlockedCount = countUnlocked(badges);
  const groupedBadges = getGroupedBadges(badges);
  const [activeBadge, setActiveBadge] = React.useState<AchievementsCardBadge | null>(null);

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
                                <BadgeTile key={badge.id} badge={badge} onOpen={setActiveBadge} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="pr-badge-grid">
                    {section.badges.map((badge) => (
                      <BadgeTile key={badge.id} badge={badge} onOpen={setActiveBadge} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
      <BadgeDetailsDialog
        badge={activeBadge}
        onClose={() => setActiveBadge(null)}
      />
    </div>
  );
}
