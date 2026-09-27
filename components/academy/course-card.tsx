import {
  Check,
  CircleCheck,
  Clock,
  Code,
  Hammer,
  Hexagon,
  MessageSquare,
  Monitor,
  Network,
  Settings,
  Terminal,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import type { CourseStats } from "@/lib/academy/course-outline";
import type { DisciplineHue } from "@/lib/academy/discipline";

// Tool icon mapping
const toolIconMap: Record<string, LucideIcon> = {
  "Console": Monitor,
  "Avalanche CLI": Terminal,
  "ICM": MessageSquare,
  "Foundry": Hammer,
  "Starter-Kit": Code,
  "Validator Manager": Settings,
  "P-Chain": Network,
  "AvaCloudSDK": Code,
  "AvaCloud API": Code,
  "HyperSDK": Terminal,
  "Chainlink VRF": Hexagon,
  "Entrepreneur": Users,
  "Thirdweb x402": Wallet,
};

export interface CourseCardProps {
  variant: "desktop" | "phone";
  name: string;
  description: string;
  /** "01", "02", ...: the course's place in the track's mobileOrder, the same at every width. */
  number: string;
  discipline: string;
  hue: DisciplineHue | null;
  icon: LucideIcon;
  /** From the page tree (index C8); undefined renders the card without counts. */
  stats: CourseStats | undefined;
  /** content/courses.tsx duration, e.g. "2 hours". */
  duration: string | undefined;
  tool: string | undefined;
  /** Production's completion (hooks/useCourseCompletion.ts): false until it loads after mount. */
  completed: boolean;
}

/** "1 hour" to "1 h", "1.5 hours" to "1.5 h", "45 minutes" to "45 min", as the approved cards print it. */
export function shortDuration(duration: string): string {
  return duration.replace(/\s*hours?$/i, " h").replace(/\s*minutes?$/i, " min");
}

const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * "31 lessons · 4 modules", the dot in its own element with 1 px side margins, as the approved cards set it;
 * a course without modules (Team1) shows its lessons alone.
 */
export function statsLabel({ lessons, modules }: CourseStats): ReactNode {
  return modules > 0 ? (
    <>
      {counted(lessons, "lesson")}
      <span className="mx-px">{" · "}</span>
      {counted(modules, "module")}
    </>
  ) : (
    counted(lessons, "lesson")
  );
}

function CardHead({ icon: Icon, hue, discipline, number, completed }: CourseCardProps) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        data-hue={hue ?? undefined}
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-ac-t text-ac-h"
      >
        <Icon className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <span className="min-w-0 truncate text-[12px] text-ac-ink-3">{discipline}</span>
      {completed ? (
        <span className="ml-auto inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ac-ok text-ac-paper">
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
      ) : (
        <span className="ml-auto shrink-0 font-ac-mono text-[11px] text-ac-ink-3">{number}</span>
      )}
    </div>
  );
}

/** Desktop: the tool shows on hover, as production's chip row did, and on keyboard focus of the wrapping link. */
function HoverTool({ tool }: { tool: string }) {
  const ToolIcon = toolIconMap[tool] || Monitor;
  return (
    <div className="flex max-h-0 items-center gap-1.5 overflow-hidden text-[11.5px] text-ac-ink-2 opacity-0 transition-all duration-300 ease-out group-hover:mt-2 group-hover:max-h-8 group-hover:opacity-100 group-focus-visible:mt-2 group-focus-visible:max-h-8 group-focus-visible:opacity-100">
      <ToolIcon className="size-3 shrink-0" aria-hidden="true" />
      <span>{tool}</span>
    </div>
  );
}

function CardFoot({ variant, stats, duration, tool, completed }: CourseCardProps) {
  const phoneTool = variant === "phone" ? tool : undefined;
  if (!phoneTool && !completed && !stats && !duration) return null;
  const ToolIcon = (phoneTool && toolIconMap[phoneTool]) || Monitor;
  return (
    <div className="mt-[7px] flex items-center gap-2.5 whitespace-nowrap border-t border-ac-rule pt-1.5 text-[11.5px] leading-[1.3] tabular-nums text-ac-ink-3">
      {/* On a 390 px card the tool name gives way first; counts and duration never truncate. */}
      {phoneTool ? (
        <span className="inline-flex min-w-0 items-center gap-[5px] text-ac-ink-2">
          <ToolIcon className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{phoneTool}</span>
        </span>
      ) : null}
      {completed ? (
        <span className="inline-flex shrink-0 items-center gap-[5px] font-medium text-ac-ok">
          <CircleCheck className="size-[13px]" aria-hidden="true" />
          Completed
        </span>
      ) : stats ? (
        <span className="shrink-0">{statsLabel(stats)}</span>
      ) : null}
      {duration ? (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1">
          <Clock className="size-3 shrink-0" aria-hidden="true" />
          {shortDuration(duration)}
        </span>
      ) : null}
    </div>
  );
}

/** The one card anatomy of the track landings (spec 4.2). */
export function CourseCard(props: CourseCardProps) {
  const { variant, name, description, tool } = props;
  return (
    <div className="relative w-full rounded-xl border border-ac-rule bg-ac-paper px-[13px] pt-2.5 pb-2 transition-colors duration-150 group-hover:border-ac-ink group-focus-visible:border-ac-ink">
      <CardHead {...props} />
      <h4 className="mb-0.5 text-[15px] font-semibold leading-[1.22] tracking-[-0.006em] text-ac-ink">{name}</h4>
      <p className={cn("text-[12.5px] leading-[1.4] text-ac-ink-3", variant === "desktop" && "line-clamp-1")}>
        {description}
      </p>
      {variant === "desktop" && tool ? <HoverTool tool={tool} /> : null}
      <CardFoot {...props} />
    </div>
  );
}
