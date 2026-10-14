import type { ReactNode } from 'react';

/*
 * Numbered sub-steps inside a console tool, a drop-in for fumadocs' docs `Steps`: a mono step number on a hairline
 * rail, the same gap between every step, and the step's own heading set in the console's type. Tools open a step with
 * an <h2> or <h3> (sometimes wrapped in a <div>) and a <p>; those are restyled here, overriding each tool's own sizes
 * and margins, so every step reads alike. CSS counters number the steps, so they stay right when a tool renders some
 * of them conditionally.
 */

const HEADING = [
  '[&>:is(h2,h3):first-child]:my-0!',
  '[&>:is(h2,h3):first-child]:text-[15px]!',
  '[&>:is(h2,h3):first-child]:font-semibold!',
  '[&>:is(h2,h3):first-child]:leading-7!',
  '[&>:is(h2,h3):first-child]:text-zinc-900!',
  'dark:[&>:is(h2,h3):first-child]:text-zinc-50!',
  '[&>div:first-child>:is(h2,h3)]:mt-0!',
  '[&>div:first-child>:is(h2,h3)]:mb-1!',
  '[&>div:first-child>:is(h2,h3)]:text-[15px]!',
  '[&>div:first-child>:is(h2,h3)]:font-semibold!',
  '[&>div:first-child>:is(h2,h3)]:leading-7!',
  '[&>div:first-child>:is(h2,h3)]:text-zinc-900!',
  'dark:[&>div:first-child>:is(h2,h3)]:text-zinc-50!',
].join(' ');

const LEAD = [
  '[&>:is(h2,h3):first-child+p]:-mt-3!',
  '[&>:is(h2,h3):first-child+p]:mb-0!',
  '[&>:is(h2,h3):first-child+p]:text-[13px]!',
  '[&>:is(h2,h3):first-child+p]:leading-relaxed!',
  '[&>:is(h2,h3):first-child+p]:text-zinc-500!',
  'dark:[&>:is(h2,h3):first-child+p]:text-zinc-400!',
  '[&>div:first-child>p]:text-[13px]!',
  '[&>div:first-child>p]:leading-relaxed!',
  '[&>div:first-child>p]:text-zinc-500!',
  'dark:[&>div:first-child>p]:text-zinc-400!',
].join(' ');

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col [counter-reset:console-step]">{children}</ol>;
}

export function Step({ children }: { children: ReactNode }) {
  return (
    <li className="group/step relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-5 pb-10 [counter-increment:console-step] last:pb-0">
      <span aria-hidden className="relative flex justify-center">
        <span className="relative z-10 flex h-7 w-7 items-center justify-center border border-zinc-300 bg-white font-mono text-[11px] font-bold tabular-nums text-zinc-700 before:content-[counter(console-step,decimal-leading-zero)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200" />
        <span className="absolute bottom-0 top-7 w-px bg-zinc-200 group-last/step:hidden dark:bg-zinc-800" />
      </span>
      <div className={`flex min-w-0 flex-col gap-4 ${HEADING} ${LEAD}`}>{children}</div>
    </li>
  );
}
