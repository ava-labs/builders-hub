import Link from 'next/link';
import {
  ArrowRight,
  ExternalLink,
  EyeOff,
  Globe2,
  LockKeyhole,
  Server,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

const headerFacts: ReadonlyArray<{ label: string; icon: LucideIcon }> = [
  { label: 'Avalanche Fuji', icon: Globe2 },
  { label: 'Existing EOA wallet', icon: Wallet },
  { label: 'No contracts to deploy', icon: Server },
];

const integrationSteps = [
  {
    title: 'Create a Project',
    description: 'Create a project and issue one server-side API key.',
  },
  {
    title: 'Add 2 Server Routes',
    description: 'Handle registration and short-lived authorization inside your existing app.',
  },
  {
    title: 'Connect the SDK',
    description: "Use your app's existing EOA wallet connection.",
  },
] as const;

const primaryLinkClass =
  'inline-flex min-h-10 touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-medium text-zinc-950 shadow-[0_4px_16px_-4px_rgba(16,185,129,0.5)] transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.35)] dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950';

const secondaryLinkClass =
  'inline-flex min-h-10 touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-white dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-950';

function HeaderFact({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />
      <span>{label}</span>
    </div>
  );
}

function IntegrationStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <li className="relative flex min-w-0 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 font-mono text-[11px] font-semibold tabular-nums text-zinc-700 ring-4 ring-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-950">
        {number}
      </span>
      <div className="min-w-0 sm:max-w-56">
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
    </li>
  );
}

function VisibilityPanel({
  tone,
  label,
  title,
  description,
}: {
  tone: 'public' | 'authorized';
  label: string;
  title: string;
  description: string;
}) {
  const authorized = tone === 'authorized';

  return (
    <div
      className={
        authorized
          ? 'rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 ring-1 ring-emerald-500/[0.04] dark:border-emerald-900/50 dark:bg-emerald-900/10 dark:ring-emerald-400/[0.06]'
          : 'rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-4 ring-1 ring-zinc-900/[0.02] dark:border-zinc-800 dark:bg-zinc-900/40 dark:ring-white/[0.02]'
      }
    >
      <h3
        className={
          authorized
            ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400'
            : 'text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500'
        }
      >
        {label}
      </h3>
      <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
  );
}

export default function UnlinkOverview() {
  return (
    <div className="relative -m-4 p-4 md:-m-8 md:p-8">
      <div className="relative mx-auto max-w-6xl space-y-3">
        <section
          className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white ring-1 ring-zinc-900/[0.02] dark:border-zinc-800/80 dark:bg-zinc-950 dark:ring-white/[0.04]"
          style={{
            boxShadow:
              '0 24px 64px -32px rgba(16,185,129,0.10), 0 8px 24px -12px rgba(0,0,0,0.05), inset 0 1px 0 0 rgba(255,255,255,0.06)',
          }}
          aria-labelledby="unlink-overview-title"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-zinc-100 bg-zinc-50/60 px-6 py-2.5 md:px-8 dark:border-zinc-900 dark:bg-white/[0.02]">
            {headerFacts.map((fact, index) => (
              <div key={fact.label} className="contents">
                {index > 0 ? (
                  <span className="hidden h-3 w-px bg-zinc-200 dark:bg-zinc-800 sm:block" aria-hidden="true" />
                ) : null}
                <HeaderFact {...fact} />
              </div>
            ))}
          </div>

          <div className="relative overflow-hidden px-6 py-7 md:px-8 md:py-8">
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/[0.08] blur-3xl dark:bg-emerald-400/[0.06]"
              aria-hidden="true"
            />

            <div className="relative flex items-start gap-4">
              <div className="relative shrink-0">
                <span
                  className="absolute inset-0 rounded-2xl bg-emerald-400/25 blur-2xl dark:bg-emerald-400/20"
                  aria-hidden="true"
                />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-200/70 dark:from-emerald-500/15 dark:to-emerald-500/5 dark:ring-emerald-400/20">
                  <LockKeyhole aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h1
                  id="unlink-overview-title"
                  className="max-w-3xl text-balance text-xl font-semibold leading-[1.1] tracking-tighter text-zinc-950 dark:text-white md:text-[1.625rem]"
                >
                  Private transfers, <span className="text-emerald-600 dark:text-emerald-400">same wallet.</span>
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Add private balances and transfers to an existing app with the Unlink SDK and one server-side project
                  API key. Unlink runs the contracts and privacy infrastructure.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link href="/console/unlink/demo" className={primaryLinkClass}>
                    Open Demo
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                  <a
                    href="https://dashboard.unlink.xyz/sign-up"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={secondaryLinkClass}
                  >
                    Create Project
                    <span className="sr-only"> (opens in a new tab)</span>
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div
            id="integration"
            className="scroll-mt-24 border-t border-zinc-100 bg-zinc-50/50 px-6 py-5 md:px-8 dark:border-zinc-900 dark:bg-zinc-950/60"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Integration
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">3 steps</span>
            </div>

            <div className="relative mt-4">
              <span
                className="absolute left-[16.667%] right-[16.667%] top-4 hidden h-px bg-zinc-200 dark:bg-zinc-800 sm:block"
                aria-hidden="true"
              />
              <ol className="grid gap-4 sm:grid-cols-3">
                {integrationSteps.map((step, index) => (
                  <IntegrationStep key={step.title} number={index + 1} {...step} />
                ))}
              </ol>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                The project API key stays on your server. Wallet-derived spending keys stay in the browser.
              </p>
              <a
                href="https://docs.unlink.xyz/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 touch-manipulation items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-950"
              >
                Quickstart
                <span className="sr-only"> (opens in a new tab)</span>
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border border-zinc-200/80 bg-white p-5 ring-1 ring-zinc-900/[0.02] dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/[0.02]"
          aria-labelledby="unlink-visibility-title"
        >
          <div className="mb-4 flex items-center gap-2">
            <EyeOff aria-hidden="true" className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <h2
              id="unlink-visibility-title"
              className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              What Is Public Onchain
            </h2>
            <a
              href="https://docs.unlink.xyz/how-unlink-works"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex min-h-10 touch-manipulation items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:ring-zinc-100 dark:focus-visible:ring-offset-zinc-950"
            >
              How Unlink Works
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <VisibilityPanel
              tone="public"
              label="Public Onchain"
              title="Pool transaction, timing, and proof."
              description="Commitments are also public. Deposits expose the source, token, and amount; withdrawals expose the destination, token, and amount."
            />
            <VisibilityPanel
              tone="authorized"
              label="Authorized Account View"
              title="Sender, recipient, token, and amount."
              description="These private transfer details are available through an authorized account session."
            />
          </div>

          <div className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <p>
              Private transfers do not publish the sender, recipient, token, or amount onchain. The demo displays the
              connected account&apos;s authorized view after processing.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
