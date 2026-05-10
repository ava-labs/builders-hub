"use client";

import * as React from "react";
import { SparkleIcon } from "./icons";
import { RoleIconRender } from "./IconRender";
import { BADGES } from "./data";

export function AchievementsCard() {
  const unlocked = BADGES.filter((b) => b.unlocked).length;
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
            {unlocked} of {BADGES.length} unlocked · keep building.
          </div>
        </div>
      </div>
      <div className="pr-body">
        <div className="pr-badge-grid">
          {BADGES.map((b) => (
            <div
              key={b.id}
              className={`pr-badge pr-${b.cls}${!b.unlocked ? " pr-locked" : ""}`}
              title={b.name}
            >
              <span className="pr-glyph">
                <RoleIconRender kind={b.icon} size={18} />
              </span>
              <span className="pr-nm">{b.name}</span>
              <span className="pr-lvl">{b.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
