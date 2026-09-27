import Link from 'next/link';
import { ArrowRight, Award, BookOpen, Clock, Layers, type LucideIcon } from 'lucide-react';
import type { CourseOutline } from '@/lib/academy/course-outline';
import type { CourseDiscipline } from '@/lib/academy/course-discipline';

/** The discipline tile and "Course · <discipline>" above the overview title. */
export function CourseHeader({ discipline }: { discipline: CourseDiscipline | null }) {
  return (
    <div data-academy-part="course-head" className="mb-3.5 flex items-center gap-3">
      {discipline && (
        <span
          data-hue={discipline.hue ?? undefined}
          className="inline-flex size-9 flex-none items-center justify-center rounded-[9px] bg-ac-t text-ac-h"
        >
          <discipline.Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
        </span>
      )}
      <span className="text-[13.5px] text-ac-ink-3">
        Course
        {discipline && (
          <>
            <span className="mx-1.5">·</span>
            <b className="font-medium text-ac-ink-2">{discipline.label}</b>
          </>
        )}
      </span>
    </div>
  );
}

function Fact({ Icon, value, label }: { Icon: LucideIcon; value?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <Icon aria-hidden="true" className="size-4 text-ac-ink-3" />
      {value && (
        <>
          <b className="font-ac-mono text-[13.5px] font-medium text-ac-ink">{value}</b>{' '}
        </>
      )}
      {label}
    </span>
  );
}

const DURATION = /^([\d.]+)\s*(.*)$/;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

interface CourseFactsProps {
  outline: CourseOutline;
  duration: string | undefined;
}

/**
 * The facts row after the overview description, ending in the ink "Start course" button.
 * The button's hover takes the outlined look (paper, ink text, an inset ink border) and its keyboard
 * focus a 2 px ink ring; neither moves a box.
 */
export function CourseFacts({ outline, duration }: CourseFactsProps) {
  const start = outline.lessons[0]?.url;
  const time = duration ? DURATION.exec(duration) : null;
  const modules = outline.modules.length;
  const lessons = outline.lessons.length;
  return (
    <div
      data-academy-part="course-facts"
      className="mt-[22px] mb-3 flex flex-wrap items-center gap-x-[22px] gap-y-2 border-b border-ac-rule pb-[26px] text-[14px] text-ac-ink-2"
    >
      {modules > 0 && <Fact Icon={Layers} value={String(modules)} label={plural(modules, 'module', 'modules')} />}{' '}
      {lessons > 0 && <Fact Icon={BookOpen} value={String(lessons)} label={plural(lessons, 'lesson', 'lessons')} />}{' '}
      {duration && <Fact Icon={Clock} value={time?.[1]} label={time ? time[2] : duration} />}{' '}
      {outline.certificateUrl && <Fact Icon={Award} label="Certificate" />}{' '}
      {start && (
        <Link
          href={start}
          className="ml-auto inline-flex items-center gap-2 rounded-[8px] bg-ac-ink py-2.5 pr-3.5 pl-4 text-[14px] font-medium leading-none text-ac-paper hover:bg-ac-paper hover:text-ac-ink hover:inset-ring hover:inset-ring-ac-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink max-md:mt-1.5 max-md:ml-0"
        >
          Start course
          <ArrowRight aria-hidden="true" className="size-[15px]" />
        </Link>
      )}
    </div>
  );
}
