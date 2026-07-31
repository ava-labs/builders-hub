import Link from "next/link";

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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <div aria-hidden className="mb-6 inline-flex flex-col items-start">
        <div className="flex">
          <span className="h-2.5 w-[30px] bg-brand" />
          <span className="h-2.5 w-[30px] bg-zinc-900 dark:bg-zinc-100" />
          <span className="h-2.5 w-[30px] bg-zinc-200 dark:bg-white/15" />
        </div>
        <div className="ml-[30px] flex">
          <span className="h-2.5 w-[30px] bg-zinc-900 dark:bg-zinc-100" />
          <span className="h-2.5 w-[30px] bg-zinc-200 dark:bg-white/15" />
        </div>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Ava Labs audit program · free for builders
      </p>
      <h1 className="mt-4 text-5xl font-black uppercase leading-[0.95] tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-6xl">
        Every vetted auditor.
        <br />
        One request.
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

      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {meta.join(" · ")}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border border-zinc-200 py-3 pl-4 pr-3 dark:border-white/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          For audit firms
        </p>
        <p className="text-sm text-zinc-600 dark:text-[#A2AFB2]">
          On the whitelist? Requests arrive by email; quotes go in through the portal.
        </p>
        <span className="flex-1" />
        <Link
          href="/audits/portal"
          className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-3.5 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40"
        >
          Open the auditor portal →
        </Link>
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-8 dark:border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
          How it works
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step}>
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
