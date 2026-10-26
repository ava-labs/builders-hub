import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CourseOutline, OutlineModule } from '@/lib/academy/course-outline';

function ModuleTile({ courseModule }: { courseModule: OutlineModule }) {
  const count = courseModule.lessons.length;
  // The border eases to ink in 150 ms, the arrow leans 2 px towards the module, and the tile presses to 0.99 in
  // 160 ms; under Reduce Motion only the colour moves (acad-tile-hover).
  return (
    <Link
      href={courseModule.firstUrl}
      className="group grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[12px] border border-ac-rule bg-ac-paper px-4 py-3.5 text-inherit transition-[border-color,background-color,color,box-shadow,scale] duration-[150ms,150ms,150ms,150ms,160ms] ease-[ease,ease,ease,ease,var(--ease-out)] hover:border-ac-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink active:scale-[0.99] motion-reduce:active:scale-100"
    >
      <span className="inline-flex size-7 items-center justify-center rounded-[8px] bg-ac-tile font-ac-mono text-[11.5px] text-ac-ink">
        {courseModule.number}
      </span>
      <span className="min-w-0 text-[14.5px] font-semibold leading-[1.3] text-ac-ink">
        {courseModule.name}
        <span className="mt-0.5 block text-[12.5px] font-normal text-ac-ink-3">
          {`${count} ${count === 1 ? 'lesson' : 'lessons'}`}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-[15px] text-ac-ink-3 transition-[translate] duration-180 ease-out motion-safe:group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** "Modules": one numbered tile per module, as the sidebar numbers them, linking to its first lesson. */
export function CourseModules({ outline }: { outline: CourseOutline }) {
  if (outline.modules.length === 0) return null;
  return (
    <section data-academy-part="course-modules" className="mt-11 mb-9">
      <h2 className="mb-3.5 font-ac-display text-[25px] font-medium tracking-[-0.015em] text-ac-ink">Modules</h2>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {outline.modules.map((courseModule) => (
          <ModuleTile key={courseModule.firstUrl} courseModule={courseModule} />
        ))}
      </div>
    </section>
  );
}
