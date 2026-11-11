"use client";

/* the answer's frame before its parts land: the figures' tiles, and the chart's tile with the wait drawn in it */

import { cn } from "@/lib/utils";
import { QueryLoader } from "../QueryLoader";
import { CARD } from "./sheet";

const BAR = "animate-pulse rounded-sm bg-zinc-200/80 motion-reduce:animate-none dark:bg-zinc-800";

/** the grid an answer fills: four figures and a chart. status is what the wait says */
export function SkeletonGrid({ status }: { status: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3 sm:gap-4">
      <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[58, 44, 66, 50].map((w, i) => (
          <div key={i} className={cn(CARD, "flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5 md:px-6")}>
            <span className={cn(BAR, "h-2.5")} style={{ width: `${w}%` }} />
            <span className={cn(BAR, "h-6 w-3/4")} />
            <span className={cn(BAR, "h-2.5 w-1/2")} />
          </div>
        ))}
      </div>
      <div className={cn(CARD, "flex min-h-[18rem] flex-1 flex-col")}>
        <QueryLoader status={status} fill framed={false} />
      </div>
    </div>
  );
}

/** a question on its way, in the answer's place: its words where the title will stand, over the grid */
export function AnswerSkeleton({ question, status }: { question: string; status: string }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="block text-[22px] font-semibold tracking-tight text-zinc-400 sm:text-[26px] dark:text-zinc-500">{question}</span>
        <span aria-hidden className="flex max-w-3xl flex-col gap-1.5 pt-1">
          {[92, 64].map((w) => (
            <span key={w} className={cn(BAR, "h-3")} style={{ width: `${w}%` }} />
          ))}
        </span>
      </div>
      <SkeletonGrid status={status} />
    </section>
  );
}
