"use client";

import * as React from "react";
import { SparkleIcon } from "./icons";

export interface AchievementsCardBadge {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  category: string;
  awardedAt: string;
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

export function AchievementsCard({ badges, loading = false }: Props) {
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
                : `${badges.length} unlocked · keep building.`}
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
        ) : badges.length === 0 ? (
          <div className="pr-empty">No badges yet.</div>
        ) : (
          <div className="pr-badge-grid">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`pr-badge ${accentFor(b.category)}`}
                title={b.description}
              >
                <span
                  className="pr-glyph"
                  style={{ background: "var(--pr-g-200)" }}
                >
                  {b.imagePath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={b.imagePath} alt="" width={96} height={96} />
                  ) : (
                    <SparkleIcon size={36} />
                  )}
                </span>
                <span className="pr-nm">{b.name}</span>
                <span className="pr-lvl">
                  {b.category.charAt(0).toUpperCase() + b.category.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
