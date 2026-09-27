"use client";

import React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import { getCourseDurations, getCourseTools } from "@/content/courses";
import { useCourseCompletion } from "@/hooks/useCourseCompletion";
import { courseDiscipline } from "@/lib/academy/course-discipline";
import type { CourseStats } from "@/lib/academy/course-outline";
import { CourseCard, type CourseCardProps } from "./course-card";
import { coursesInOrder, courseUrl, getAcademyTrack, twoDigits, type AcademyTrack } from "./shared/academy-tracks";
import type { AcademyPathType } from "./shared/academy-types";

// CourseNode interface definition
export interface CourseNode {
    id: string;
    name: string;
    description: string;
    slug: string;
    category: string;
    position: { x: number; y: number };
    dependencies?: string[];
    mobileOrder: number;
}

interface LearningTreeProps {
  pathType?: AcademyPathType;
  /** Lessons and modules per course url, from the track page. */
  courseStats: Record<string, CourseStats>;
}

// Get course durations and tools once
const courseDurations = getCourseDurations();
const courseTools = getCourseTools();

// Helper to extract course slug from full path (e.g., "avalanche-l1/avalanche-fundamentals" to "avalanche-fundamentals")
const getCourseSlug = (fullSlug: string): string => {
  const parts = fullSlug.split('/');
  return parts[parts.length - 1];
};

// Lines leave a parent 95 px below its top, as before the reskin. Cards are now up to 139 px tall and their
// paper covers that start, so each line appears at the card's bottom edge.
const EDGE_START = 95;
// Lines end 5 px inside the child card, under its paper.
const EDGE_END_INSET = 5;

// The card cannot take focus, so its link carries the `group` the card's hover and focus reveals key on,
// and draws the 2 px ink focus ring (the card draws none).
const CARD_LINK = "block relative group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink";

export interface TreeEdge {
  key: string;
  d: string;
  completed: boolean;
}

/** One curve per dependency, in the SVG's space (x in percent of the width, y in px). */
export function treeEdges(courses: readonly CourseNode[], completion: ReadonlyMap<string, boolean>): TreeEdge[] {
  return courses.flatMap((node) =>
    (node.dependencies ?? []).flatMap((dependencyId) => {
      const parent = courses.find((candidate) => candidate.id === dependencyId);
      if (!parent) return [];
      const startY = parent.position.y + EDGE_START;
      const midY = (startY + node.position.y) / 2;
      const endY = node.position.y + EDGE_END_INSET;
      const d = `M ${parent.position.x} ${startY} C ${parent.position.x} ${midY}, ${node.position.x} ${midY}, ${node.position.x} ${endY}`;
      return [{ key: `${dependencyId}-${node.id}`, d, completed: completion.get(node.id) === true }];
    }),
  );
}

type CardContent = Omit<CourseCardProps, "variant">;

function cardContent(
  node: CourseNode,
  track: AcademyTrack,
  number: string,
  courseStats: Record<string, CourseStats>,
  completed: boolean,
): CardContent {
  const courseSlug = getCourseSlug(node.slug);
  // The discipline as the course overview shows it (label, icon, hue from the track config).
  const discipline = courseDiscipline(track.segment, courseSlug);
  return {
    name: node.name,
    description: node.description,
    number,
    discipline: discipline?.label ?? node.category,
    hue: discipline?.hue ?? null,
    icon: discipline?.Icon ?? BookOpen,
    stats: courseStats[courseUrl(track.id, node.slug)],
    duration: courseDurations[courseSlug],
    tool: courseTools[courseSlug],
    completed,
  };
}

interface TreeViewProps {
  track: AcademyTrack;
  card: (node: CourseNode) => CardContent;
  completion: ReadonlyMap<string, boolean>;
}

/** The lines behind the desktop cards: the line token at 1 px, lines into completed courses in the ok token at 1.5 px. */
function TreeLines({ courses, completion, maxY }: { courses: readonly CourseNode[]; completion: ReadonlyMap<string, boolean>; maxY: number }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 100 ${maxY}`}
      style={{ height: `${maxY}px`, zIndex: 1 }}
      preserveAspectRatio="none"
    >
      <defs>
        <marker id="academy-arrow-line" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ac-line" />
        </marker>
        <marker id="academy-arrow-ok" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ac-ok" />
        </marker>
      </defs>
      {treeEdges(courses, completion).map((edge) => (
        <path
          key={edge.key}
          d={edge.d}
          fill="none"
          className={cn("transition-all duration-700 ease-in-out", edge.completed ? "stroke-ac-ok" : "stroke-ac-line")}
          strokeWidth={edge.completed ? 1.5 : 1}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={edge.completed ? "url(#academy-arrow-ok)" : "url(#academy-arrow-line)"}
        />
      ))}
    </svg>
  );
}

function DesktopTree({ track, card, completion }: TreeViewProps) {
  // Calculate SVG dimensions based on node positions
  const maxY = Math.max(...track.courses.map((node) => node.position.y)) + 200;
  return (
    <div className="relative p-8 lg:p-12" style={{ minHeight: `${maxY}px` }}>
      <TreeLines courses={track.courses} completion={completion} maxY={maxY} />
      {track.courses.map((node) => (
        // A focused card rises above its neighbours, whose paper would cover its ring where cards sit 2 px apart (1024 px).
        <div
          key={node.id}
          className="absolute z-10 flex justify-center focus-within:z-20"
          style={{ left: `${node.position.x}%`, top: `${node.position.y}px`, transform: 'translateX(-50%)', width: '238px' }}
        >
          <Link href={courseUrl(track.id, node.slug)} className={cn(CARD_LINK, "w-full")}>
            <CourseCard variant="desktop" {...card(node)} />
          </Link>
        </div>
      ))}
    </div>
  );
}

function MobileTree({ track, ordered, card, completion }: TreeViewProps & { ordered: readonly CourseNode[] }) {
  return (
    <div className="relative w-full px-4 py-6">
      <div className="space-y-4">
        {ordered.map((node, index) => (
          <div key={node.id} className="relative">
            {/* Arrow from the previous course: the line token, the ok token into a completed course */}
            {index > 0 && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <svg width="16" height="16" viewBox="0 0 16 16" className={completion.get(node.id) === true ? "text-ac-ok" : "text-ac-line"}>
                  <path d="M8 2 L8 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M4 8 L8 12 L12 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>
            )}
            <Link href={courseUrl(track.id, node.slug)} className={CARD_LINK}>
              <CourseCard variant="phone" {...card(node)} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LearningTree({ pathType = 'avalanche', courseStats }: LearningTreeProps) {
  const track = getAcademyTrack(pathType);
  const ordered = React.useMemo(() => coursesInOrder(track.courses), [track]);

  // Course completion tracking (IndexedDB). The map stays empty until the hook's effect runs after
  // mount, so the server markup is the neutral state.
  const courseEntries = React.useMemo(
    () => track.courses.map((node) => ({ nodeId: node.id, courseSlug: getCourseSlug(node.slug) })),
    [track],
  );
  const { completionMap } = useCourseCompletion(courseEntries);

  // One number per course at every width: its place in the mobileOrder sort.
  const numbers = new Map(ordered.map((node, index) => [node.id, twoDigits(index + 1)]));
  const card = (node: CourseNode) =>
    cardContent(node, track, numbers.get(node.id) ?? "", courseStats, completionMap.get(node.id) === true);

  return (
    <div className="relative w-full">
      {/* Mobile layout: visible on small screens, hidden on lg and up */}
      <div className="block lg:hidden">
        <MobileTree track={track} ordered={ordered} card={card} completion={completionMap} />
      </div>

      {/* Desktop layout: hidden on small screens, visible on lg and up */}
      <div className="hidden lg:block">
        <DesktopTree track={track} card={card} completion={completionMap} />
      </div>
    </div>
  );
}
