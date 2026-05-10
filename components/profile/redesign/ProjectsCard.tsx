"use client";

import * as React from "react";
import { Plus, ExternalLink } from "lucide-react";
import { PuzzleIcon } from "./icons";

interface ProjectVM {
  id: string | number;
  name: string;
  description: string;
  tags: string[];
  status: "live" | "wip";
  role: string;
  stars?: number;
}

const PLACEHOLDER_PROJECTS: ProjectVM[] = [
  {
    id: 1,
    name: "Gold Mine Dex",
    description:
      "A liquidity hub built on Avalanche C-Chain with cross-subnet routing.",
    tags: ["Solidity", "Subnets", "TypeScript"],
    status: "live",
    role: "Founder",
    stars: 241,
  },
  {
    id: 2,
    name: "Ava Education Cohort",
    description: "8-week onboarding for Latin American developers entering web3.",
    tags: ["Education", "LatAm", "DevRel"],
    status: "live",
    role: "Lead",
    stars: 88,
  },
  {
    id: 3,
    name: "Subnet Toolkit (alpha)",
    description: "CLI for spinning up dev subnets in seconds.",
    tags: ["Rust", "Subnets", "CLI"],
    status: "wip",
    role: "Maintainer",
    stars: 32,
  },
];

const MARK_GRADIENTS: Record<string | number, string> = {
  1: "linear-gradient(135deg,#e84142,#9c2c2d)",
  2: "linear-gradient(135deg,#6676b3,#4d5a8d)",
  3: "linear-gradient(135deg,#1a1816,#3a3833)",
};

interface Props {
  projects?: ProjectVM[];
}

export function ProjectsCard({ projects = PLACEHOLDER_PROJECTS }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head">
        <div className="pr-ico">
          <PuzzleIcon size={18} />
        </div>
        <div>
          <h3>Projects</h3>
          <div className="pr-desc">
            Things you've built or shipped — link your repos and live URLs.
          </div>
        </div>
        <div className="pr-right">
          <button type="button" className="pr-btn pr-btn--sm pr-btn--outline">
            <Plus size={13} /> New project
          </button>
        </div>
      </div>
      <div className="pr-body" style={{ gap: 12 }}>
        {/* TODO(profile-redesign): persist projects */}
        {projects.map((p) => (
          <div className="pr-project-row" key={p.id}>
            <div
              className="pr-mark"
              style={{
                background:
                  MARK_GRADIENTS[p.id] ?? "linear-gradient(135deg,#3a3833,#1a1816)",
              }}
            >
              {p.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                {p.status === "live" ? (
                  <span className="pr-chip pr-chip--success">
                    <span className="pr-dot" /> Live
                  </span>
                ) : (
                  <span className="pr-chip">
                    <span
                      className="pr-dot"
                      style={{ background: "var(--pr-warning-main)" }}
                    />{" "}
                    WIP
                  </span>
                )}
                <span className="pr-chip">{p.role}</span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--pr-g-700)",
                  lineHeight: 1.4,
                  marginTop: 4,
                }}
              >
                {p.description}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="pr-chip"
                    style={{ height: 22, fontSize: 11 }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 6,
                flexShrink: 0,
              }}
            >
              {typeof p.stars === "number" && (
                <span
                  style={{
                    fontFamily: "var(--pr-mono)",
                    fontSize: 11,
                    color: "var(--pr-g-700)",
                  }}
                >
                  ★ {p.stars}
                </span>
              )}
              <button
                type="button"
                className="pr-btn pr-btn--icon pr-btn--ghost"
                aria-label="Open project"
              >
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="pr-btn pr-btn--outline"
          style={{ alignSelf: "flex-start", borderStyle: "dashed" }}
        >
          <Plus size={14} /> Link another project
        </button>
      </div>
    </div>
  );
}
