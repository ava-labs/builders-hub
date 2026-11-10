'use client';

import { Bone, FRAME } from './ui';

const STEP_LABEL_WIDTHS = ['w-12', 'w-12', 'w-14', 'w-16', 'w-20', 'w-10'];

/** The wizard's real chrome while bridge state migrates: step header, six-segment track, ribbon and body frame. */
export function BridgeSkeleton() {
  return (
    <div role="status" aria-label="Loading bridge" aria-busy className="flex flex-col">
      <div className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Bone className="h-3 w-40" />
          <span className="flex-1" />
          <Bone className="h-9 w-36" />
        </div>
        <div className="flex gap-1">
          {STEP_LABEL_WIDTHS.map((_, i) => (
            <Bone key={i} className="h-1 flex-1" />
          ))}
        </div>
        <div className="flex gap-x-5">
          {STEP_LABEL_WIDTHS.map((w, i) => (
            <Bone key={i} className={`h-3 ${w}`} />
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 py-6 dark:border-zinc-800">
        <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-800">
          {[0, 1, 2].map((i) =>
            i === 1 ? (
              <div key={i} className="flex items-center justify-center bg-white px-5 py-3 dark:bg-zinc-950">
                <Bone className="h-3 w-10" />
              </div>
            ) : (
              <div key={i} className="flex items-start gap-3 bg-white px-4 py-3.5 dark:bg-zinc-950">
                <Bone className="h-9 w-9" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Bone className="h-2.5 w-24" />
                  <Bone className="h-3.5 w-36" />
                  <Bone className="h-2.5 w-28" />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className={FRAME}>
        <div className="flex flex-col gap-4 px-5 py-5">
          <Bone className="h-3 w-3/5" />
          <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2 bg-white p-4 dark:bg-zinc-950">
                <Bone className="h-3.5 w-28" />
                <Bone className="h-2.5 w-full" />
                <Bone className="h-2.5 w-2/3" />
              </div>
            ))}
          </div>
          <Bone className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
