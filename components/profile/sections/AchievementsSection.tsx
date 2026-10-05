"use client";

import * as React from "react";
import Image from "next/image";
import { Award, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AcademyCourse } from "@/components/academy/learning-path-configs/academy.config";
import { academyCourseUrl } from "@/lib/academy/academy-programme";
import { courseOfCertificate } from "@/lib/academy/course-certificates";
import type { AcademyProgress, ProfileBadgeSummary } from "@/server/services/profile-summary";
import type { Requirement } from "@/types/badge";
import {
  Button,
  Cell,
  EmptyState,
  ErrorLine,
  FOCUS,
  Group,
  LinkButton,
  MONO_LABEL,
  Row,
  SectionHeader,
  SkeletonRows,
  Stack,
  StatusMark,
  Tag,
} from "../ui";
import { formatDay } from "./format";

export type AchievementBadge = ProfileBadgeSummary;
export type { AcademyProgress };

type OpenBadge = (badge: AchievementBadge, from: HTMLButtonElement) => void;

/** The one course a badge is for; null for a Graduate, a hackathon prize, or a removed course. */
function courseOfBadge(badge: AchievementBadge): AcademyCourse | null {
  const courses = new Set(badge.requirements.map((r) => courseOfCertificate(r.course_id)));
  const [only] = [...courses];
  return courses.size === 1 ? only : null;
}

function requirementText(requirement: Requirement): string {
  if (requirement.description) return requirement.description;
  if (requirement.course_id) {
    return `Complete the ${courseOfCertificate(requirement.course_id)?.name ?? requirement.course_id} course`;
  }
  if (requirement.type === "hackathon") return "Win a prize at a hackathon";
  return "Meet the badge requirement";
}

/** "Oct 3, 2026": the day a badge was earned, in the viewer's time zone */
function earnedDay(badge: AchievementBadge): string | null {
  return badge.isUnlocked && badge.awardedAt ? formatDay(badge.awardedAt) || null : null;
}

function BadgeImage({ badge, className }: { badge: AchievementBadge; className: string }) {
  if (!badge.imagePath) return <Award aria-hidden className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />;
  return (
    <Image
      src={badge.imagePath}
      alt=""
      width={80}
      height={80}
      unoptimized
      // the badge art has a white ground: multiply melts it into the light
      // tint; on dark it sits on a white plate, like a printed badge
      className={cn(
        "object-contain mix-blend-multiply dark:bg-white dark:p-1.5 dark:mix-blend-normal",
        !badge.isUnlocked && "opacity-40 grayscale dark:opacity-45",
        className,
      )}
    />
  );
}

function BadgeTile({ badge, onOpen }: { badge: AchievementBadge; onOpen: OpenBadge }) {
  const earned = badge.isUnlocked;
  return (
    <li>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${badge.name}, ${earned ? "earned" : "not yet earned"}`}
        onClick={(event) => onOpen(badge, event.currentTarget)}
        className={cn(
          "flex h-full w-full flex-col items-start gap-2.5 border border-zinc-200 p-3 text-left transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100",
          FOCUS,
        )}
      >
        <span className="flex h-24 w-full items-center justify-center bg-zinc-50 sm:h-28 dark:bg-zinc-900/60">
          <BadgeImage badge={badge} className="h-16 w-16 sm:h-20 sm:w-20" />
        </span>
        <span
          className={cn(
            "line-clamp-2 text-[13px] font-medium leading-snug",
            earned ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400",
          )}
        >
          {badge.name}
        </span>
        <span className="mt-auto">
          <Tag tone={earned ? "red" : "plain"}>{earned ? "Earned" : "Not yet"}</Tag>
        </span>
      </button>
    </li>
  );
}

function BadgeGrid({ badges, label, onOpen }: { badges: AchievementBadge[]; label: string; onOpen: OpenBadge }) {
  return (
    <Cell>
      <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {badges.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} onOpen={onOpen} />
        ))}
      </ul>
    </Cell>
  );
}

function ProgressRow({ academy }: { academy: AcademyProgress }) {
  const { completed, total } = academy;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : 0;
  const text = `${completed} of ${total} courses`;
  return (
    <Row label="Progress">
      <div className="flex items-center gap-4">
        <span className="shrink-0 font-mono text-[13px] text-zinc-900 dark:text-zinc-100">{text}</span>
        <div
          role="progressbar"
          aria-label="Academy courses completed"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-valuetext={text}
          className="h-[3px] min-w-0 flex-1 bg-zinc-200 dark:bg-zinc-800"
        >
          <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Row>
  );
}

/* The badge's detail, square in the sheet idiom: a label strip, the badge,
   its description and its requirements, one per row. */
function BadgeDialog({
  badge,
  open,
  onClose,
  returnFocus,
}: {
  /** the last badge opened; it stays set while the dialog closes, so the content does not empty mid-fade */
  badge: AchievementBadge | null;
  open: boolean;
  onClose: () => void;
  /** the tile that opened the dialog: Radix returns focus only to a DialogTrigger */
  returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const day = badge ? earnedDay(badge) : null;
  const course = badge && !badge.isUnlocked && badge.group === "academy" ? courseOfBadge(badge) : null;
  return (
    <Dialog
      open={open && badge !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-none border-zinc-200 bg-white p-0 shadow-none sm:max-w-md dark:border-zinc-800 dark:bg-zinc-950"
      >
        {badge && (
          <>
            <div className="flex min-h-10 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 py-1 pr-1.5 pl-4 sm:pl-5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className={cn(MONO_LABEL, "text-zinc-500 dark:text-zinc-400")}>
                {badge.group === "academy" ? "Academy badge" : "Hackathon badge"}
              </p>
              <DialogClose asChild>
                <Button variant="ghost" aria-label="Close" className="h-8 w-8 px-0">
                  <X aria-hidden className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>

            <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-zinc-50 dark:bg-zinc-900/60">
                <BadgeImage badge={badge} className="h-14 w-14" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-[18px] leading-snug font-medium text-zinc-900 dark:text-zinc-50">
                  {badge.name}
                </DialogTitle>
                <DialogDescription className="mt-1.5 flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                  <StatusMark tone={badge.isUnlocked ? "ok" : "idle"} />
                  {badge.isUnlocked ? "Earned" : "Not yet earned"}
                  {day && badge.awardedAt && (
                    <time dateTime={badge.awardedAt} className="text-zinc-900 dark:text-zinc-100">
                      {day}
                    </time>
                  )}
                </DialogDescription>
              </div>
            </div>

            {badge.description && (
              <p className="border-t border-zinc-200 px-4 py-4 text-[14px] text-zinc-600 sm:px-5 dark:border-zinc-800 dark:text-zinc-300">
                {badge.description}
              </p>
            )}

            {badge.requirements.length > 0 && (
              <div className="border-t border-zinc-200 dark:border-zinc-800">
                <h3 className={cn(MONO_LABEL, "px-4 pt-4 pb-2 text-zinc-500 sm:px-5 dark:text-zinc-400")}>
                  Requirements
                </h3>
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {badge.requirements.map((requirement, index) => (
                    <li
                      key={`${index}-${requirement.id}`}
                      className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5"
                    >
                      <span className="flex min-w-0 items-start gap-2.5 text-[14px] text-zinc-900 dark:text-zinc-100">
                        <span className="mt-[7px] flex">
                          <StatusMark tone={requirement.unlocked ? "ok" : "idle"} />
                        </span>
                        {requirementText(requirement)}
                      </span>
                      <span className={cn(MONO_LABEL, "shrink-0 pt-1 text-zinc-500 dark:text-zinc-400")}>
                        {requirement.unlocked ? "Done" : "To do"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {course && (
              <div className="flex justify-end border-t border-zinc-200 px-4 py-3 sm:px-5 dark:border-zinc-800">
                <LinkButton href={academyCourseUrl(course)}>Open course</LinkButton>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AchievementsSection({
  badges,
  academy,
  loading,
  failed,
  onRetry,
}: {
  /** GET /api/profile/summary `badges`: the Academy badges in reading order, then the hackathon badges earned */
  badges: AchievementBadge[];
  /** GET /api/profile/summary `academy`; null hides the progress row */
  academy: AcademyProgress | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const [selected, setSelected] = React.useState<AchievementBadge | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const opener = React.useRef<HTMLButtonElement | null>(null);
  const openBadge = React.useCallback<OpenBadge>((badge, from) => {
    opener.current = from;
    setSelected(badge);
    setDialogOpen(true);
  }, []);

  const academyBadges = badges.filter((b) => b.group === "academy");
  const hackathonBadges = badges.filter((b) => b.group === "hackathon" && b.isUnlocked);

  let body: React.ReactNode;
  if (failed) {
    body = (
      <Group label="Badges">
        <ErrorLine onRetry={onRetry}>Could not load your badges.</ErrorLine>
      </Group>
    );
  } else if (loading) {
    body = (
      <>
        <Group label="Academy">
          <SkeletonRows rows={3} />
        </Group>
        <Group label="Hackathons">
          <SkeletonRows rows={1} />
        </Group>
      </>
    );
  } else {
    body = (
      <>
        <Group label="Academy">
          {academy && <ProgressRow academy={academy} />}
          {academyBadges.length > 0 ? (
            <BadgeGrid badges={academyBadges} label="Academy badges" onOpen={openBadge} />
          ) : (
            <EmptyState>No Academy badges yet.</EmptyState>
          )}
        </Group>
        <Group label="Hackathons">
          {hackathonBadges.length > 0 ? (
            <BadgeGrid badges={hackathonBadges} label="Hackathon badges" onOpen={openBadge} />
          ) : (
            <EmptyState action={<LinkButton href="/hackathons">Browse hackathons</LinkButton>}>
              No hackathon badges yet. Win a prize at a hackathon to earn one.
            </EmptyState>
          )}
        </Group>
      </>
    );
  }

  return (
    <>
      <SectionHeader
        eyebrow="Activity"
        title="Achievements"
        id="section-title"
        action={<LinkButton href="/academy">Open Academy</LinkButton>}
      />
      <Stack>{body}</Stack>
      <BadgeDialog badge={selected} open={dialogOpen} onClose={() => setDialogOpen(false)} returnFocus={opener} />
    </>
  );
}
