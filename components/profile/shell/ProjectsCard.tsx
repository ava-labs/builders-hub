"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, ExternalLink, Trophy } from "lucide-react";
import { PuzzleIcon, GitHubIcon } from "./icons";

const BUILD_GAMES_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export interface ProjectsCardProject {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isWinner: boolean;
  hackathonId: string | null;
  hackathonTitle: string | null;
  logoUrl: string | null;
  demoLink: string | null;
  githubRepository: string | null;
  role: string;
}

function projectEditHref(project: ProjectsCardProject): string {
  if (project.hackathonId === BUILD_GAMES_HACKATHON_ID) {
    return "/build-games/submit?stage=1";
  }
  return `/events/project-submission?project=${encodeURIComponent(project.id)}`;
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
  const router = useRouter();
  return (
    <div className="pr-card">
      <div className="pr-head" style={{ alignItems: "flex-start" }}>
        <div className="pr-ico">
          <PuzzleIcon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>Projects</h3>
          <div className="pr-desc">
            {loading
              ? "Loading projects..."
              : projects.length === 0
                ? "No projects yet — submit one via Hackathons or the Showcase."
                : "Things you've built or shipped."}
          </div>
        </div>
        {/* Discoverability for Ecosystem Careers from the Projects card. */}
        <div
          style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}
        >
          <Link
            href="/ecosystem-careers/my-listings"
            className="pr-btn pr-btn-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--pr-g-300)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <Briefcase size={14} />
            My job listings
          </Link>
          <Link
            href="/ecosystem-careers/submit"
            className="pr-btn pr-btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 8,
              background:
                "linear-gradient(90deg,#dc2626,#ef4444)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            Post a role
          </Link>
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
            const editHref = projectEditHref(p);
            const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
              // Skip when the click started on an inner link/button so the
              // external repo / demo anchors keep working.
              const target = e.target as HTMLElement;
              if (target.closest('a, button')) return;
              router.push(editHref);
            };
            return (
              <div
                className="pr-project-row"
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={handleRowClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(editHref);
                  }
                }}
                style={{ cursor: "pointer" }}
                aria-label={`Edit ${p.name} submission`}
              >
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
