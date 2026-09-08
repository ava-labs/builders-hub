import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BlocksArt } from "@/components/audits/shared/BlocksArt";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Submit your scope",
    body: "Four short steps. Import your Builder Hub project to pre-fill.",
  },
  {
    step: "02",
    title: "Quotes come to you",
    body: "Every whitelisted firm is notified; quotes land within the 10-day window.",
  },
  {
    step: "03",
    title: "Pick one, get subsidized",
    body: "Contacts revealed on acceptance; the program can pay up to 75%.",
  },
];

/** Public landing for anonymous visitors (design 4a). Copy verbatim. */
export function AuditsLanding({ firmCount }: { firmCount: number }) {
  const meta = [
    `${firmCount} vetted firms`,
    "quotes private to you",
    "up to 75% subsidized",
    "$0 fees",
  ];

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-12 sm:py-16">
      {/* The masthead accent (round-3 N-3, resized on Federico's review): a
          quiet corner staircase pinned to the container edge, well clear of
          the headline. Desktop only · accents, never wallpaper. */}
      {/* rows = cols completes the staircase: column heights step 1-2-3-4,
          so the faintest column is the tallest (Federico, dark review). */}
      <BlocksArt
        cols={4}
        rows={4}
        size="md"
        variant="corner"
        className="absolute right-0 top-10 hidden lg:inline-flex"
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Ava Labs audit program · free for builders
      </p>
      <h1 className="v2-display mt-4 text-5xl text-zinc-950 dark:text-zinc-50 sm:text-6xl">
        Every vetted auditor.
        <br />
        {/* Ink at rest, red as motion: a recurring sheen sweeps the words;
            only the full stop holds the brand at rest. */}
        <span className="audits-word-fill">One request</span>
        <span className="text-brand">.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-[#A2AFB2]">
        Describe your scope once. Every security firm on the Ava Labs whitelist quotes it,
        privately. You compare, pick one, and the program can pay up to 75%.
      </p>
      <div className="mt-6">
        <Link
          href="/audits/new"
          className="audits-sweep inline-flex h-12 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors"
        >
          Request quotes
        </Link>
      </div>

      {/* Indented to the same 16px rail as the FOR AUDIT FIRMS row and the
          plate label below: the three mono-caps lines share one left edge. */}
      <p className="mt-8 pl-4 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {meta.join(" · ")}
      </p>

      <Link
        href="/audits/portal"
        className="group relative mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-zinc-200 py-3.5 pl-4 pr-2 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-900/60"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-transparent transition-colors duration-300 group-hover:bg-brand"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          For audit firms
        </span>
        <span className="text-sm text-zinc-600 dark:text-[#A2AFB2]">
          On the whitelist? Requests arrive by email; quotes go in through the portal.
        </span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
          Sign in
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
          />
        </span>
      </Link>

      {/* The X3-A plate as mocked on the round-3 board: the steps live inside
          one framed compartment card, mono label on top, 1px hairline gutters
          between the columns (horizontal when stacked at mobile). */}
      <div className="mt-12 rounded-xl border border-zinc-200 dark:border-white/10">
        <h2 className="px-4 pt-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-900 dark:text-zinc-100">
          How it works
        </h2>
        <div className="mt-2 sm:grid sm:grid-cols-3">
          {HOW_IT_WORKS.map((item, index) => (
            <div
              key={item.step}
              className={cn(
                "border-zinc-200 px-4 py-4 dark:border-white/10",
                index > 0 && "border-t sm:border-l sm:border-t-0",
              )}
            >
              <p className="font-mono text-sm text-brand dark:text-brand-soft">{item.step}</p>
              <p className="mt-2 font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-[#A2AFB2]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
