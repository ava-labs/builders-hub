"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GitHubIcon } from "../shell/icons";
import { firstExternalUrl, projectEditHref, projectRoleLabel } from "./model";
import type { ProfileProject } from "./types";
import { EmptyState, ErrorLine, FOCUS, Group, LinkButton, SectionHeader, SkeletonRows, Stack, Tag } from "../ui";

export type { ProfileProject } from "./types";

/** a square icon link, the size of a compact chip */
const ICON_LINK =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100";

export function ProjectsSection({
  projects,
  loading = false,
  failed = false,
  onRetry,
}: {
  projects: ProfileProject[];
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}) {
  let body: React.ReactNode;
  if (failed) {
    body = <ErrorLine onRetry={onRetry}>Could not load your projects.</ErrorLine>;
  } else if (loading) {
    body = (
      // one child, so the group's row divider draws no second line under the label strip
      <div>
        <span role="status" className="sr-only">
          Loading your projects
        </span>
        <SkeletonRows rows={3} />
      </div>
    );
  } else if (projects.length === 0) {
    body = (
      <EmptyState action={<LinkButton href="/hackathons">Browse hackathons</LinkButton>}>No projects yet.</EmptyState>
    );
  } else {
    body = (
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <SectionHeader
        eyebrow="Activity"
        title="Projects"
        id="section-title"
        action={<LinkButton href="/hackathons">Browse hackathons</LinkButton>}
      />
      <Stack>
        <Group label="Your projects">{body}</Group>
      </Stack>
    </>
  );
}

function ProjectRow({ project: p }: { project: ProfileProject }) {
  const role = projectRoleLabel(p.role);
  const repo = firstExternalUrl(p.githubRepository);
  const demo = firstExternalUrl(p.demoLink);
  return (
    <li className="flex items-start gap-4 px-4 py-3.5 sm:px-5">
      <ProjectMark name={p.name} logoUrl={p.logoUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              href={projectEditHref(p)}
              aria-label={`Edit ${p.name}`}
              className={cn(
                "min-w-0 truncate text-[14px] font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100",
                FOCUS,
              )}
            >
              {p.name}
            </Link>
            {p.isWinner && <Tag tone="red">Winner</Tag>}
            {role && <Tag>{role}</Tag>}
          </div>
          {p.hackathonTitle && (
            <p className="mt-1 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{p.hackathonTitle}</p>
          )}
          {p.description && (
            <p className="mt-1 line-clamp-2 text-[13px] text-zinc-500 dark:text-zinc-400">{p.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {repo && (
            <a
              href={repo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${p.name} repository (opens in a new tab)`}
              title="Repository"
              className={cn(ICON_LINK, FOCUS)}
            >
              <GitHubIcon aria-hidden className="h-3.5 w-3.5" />
            </a>
          )}
          {demo && (
            <a
              href={demo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${p.name} demo (opens in a new tab)`}
              title="Demo"
              className={cn(ICON_LINK, FOCUS)}
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </a>
          )}
          <Link
            href={`/audits/new?project=${encodeURIComponent(p.id)}`}
            aria-label={`Request an audit for ${p.name}`}
            title="Request an audit"
            className={cn(ICON_LINK, FOCUS)}
          >
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </li>
  );
}

/** the project's logo, or its first letter when it has none or the image fails */
function ProjectMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [broken, setBroken] = React.useState(false);
  const src = broken ? null : logoUrl;
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-zinc-50 font-mono text-[13px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      {src ? (
        // a user-entered host: no referrer goes to it
        <img
          src={src}
          alt=""
          width={36}
          height={36}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}
