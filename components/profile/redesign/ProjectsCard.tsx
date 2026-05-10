"use client";

import * as React from "react";
import { ExternalLink, Trophy } from "lucide-react";
import { PuzzleIcon, GitHubIcon } from "./icons";

export interface ProjectsCardProject {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isWinner: boolean;
  hackathonTitle: string | null;
  logoUrl: string | null;
  demoLink: string | null;
  githubRepository: string | null;
  role: string;
}

interface Props {
  projects: ProjectsCardProject[];
  loading?: boolean;
}

function gradientFor(name: string): string {
  // Stable per-name gradient so re-renders don't flash a different color.
  const palette = [
    "linear-gradient(135deg,#e84142,#9c2c2d)",
    "linear-gradient(135deg,#6676b3,#4d5a8d)",
    "linear-gradient(135deg,#3a3833,#1a1816)",
    "linear-gradient(135deg,#b9eb7c,#668b22)",
    "linear-gradient(135deg,#fdc85d,#8b6100)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function ProjectsCard({ projects, loading = false }: Props) {
  return (
    <div className="pr-card">
      <div className="pr-head">
        <div className="pr-ico">
          <PuzzleIcon size={18} />
        </div>
        <div>
          <h3>Projects</h3>
          <div className="pr-desc">
            {loading
              ? "Loading projects..."
              : projects.length === 0
                ? "No projects yet — submit one via Hackathons or the Showcase."
                : "Things you've built or shipped."}
          </div>
        </div>
      </div>
      <div className="pr-body" style={{ gap: 12 }}>
        {loading ? (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="pr-project-row"
                style={{ opacity: 0.4 }}
                aria-hidden
              >
                <div
                  className="pr-mark"
                  style={{ background: "var(--pr-g-300)" }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: "40%",
                      height: 14,
                      background: "var(--pr-g-300)",
                      borderRadius: 4,
                    }}
                  />
                  <div
                    style={{
                      width: "70%",
                      height: 12,
                      background: "var(--pr-g-300)",
                      borderRadius: 4,
                      marginTop: 6,
                    }}
                  />
                </div>
              </div>
            ))}
          </>
        ) : projects.length === 0 ? (
          <div className="pr-empty">No projects yet.</div>
        ) : (
          projects.map((p) => {
            const externalHref = p.demoLink || p.githubRepository || null;
            return (
              <div className="pr-project-row" key={p.id}>
                <div
                  className="pr-mark"
                  style={{
                    background: gradientFor(p.name),
                    overflow: "hidden",
                  }}
                >
                  {p.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.logoUrl}
                      alt=""
                      width={44}
                      height={44}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    p.name.charAt(0).toUpperCase()
                  )}
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
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                    {p.isWinner && (
                      <span className="pr-chip pr-chip--gold">
                        <Trophy size={11} /> Winner
                      </span>
                    )}
                    {p.hackathonTitle && (
                      <span className="pr-chip">{p.hackathonTitle}</span>
                    )}
                    {p.role && p.role !== "member" && (
                      <span className="pr-chip">
                        {p.role.charAt(0).toUpperCase() + p.role.slice(1)}
                      </span>
                    )}
                  </div>
                  {p.description && (
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
                  )}
                  {p.tags.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {p.tags.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="pr-chip"
                          style={{ height: 22, fontSize: 11 }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
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
                  {p.githubRepository && (
                    <a
                      href={p.githubRepository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pr-btn pr-btn--icon pr-btn--ghost"
                      aria-label="Open repository"
                    >
                      <GitHubIcon size={14} />
                    </a>
                  )}
                  {externalHref && (
                    <a
                      href={externalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pr-btn pr-btn--icon pr-btn--ghost"
                      aria-label="Open project"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
