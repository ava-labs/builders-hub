import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PublicFirm } from "@/server/services/audits/visibility";
import { MONO_LABEL } from "@/components/audits/shared/classes";
import { hostOf, monogramOf, truncate } from "@/components/audits/shared/format";
import { isAllowedLogoSrc } from "@/lib/audits/logoSrc";

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-white/15 dark:text-zinc-300";

function FirmRow({ firm }: { firm: PublicFirm }) {
  const host = firm.website ? hostOf(firm.website) : "";
  const showLogo = firm.logo_url ? isAllowedLogoSrc(firm.logo_url) : false;
  return (
    <div className="flex items-start gap-4 border-b border-zinc-200 px-5 py-4 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.03]">
      {showLogo ? (
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={firm.logo_url as string} alt="" className="h-[26px] w-[26px] object-contain" />
        </span>
      ) : (
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-mono text-[13px] font-semibold tracking-[0.04em] text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
        >
          {monogramOf(firm.firm_name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{firm.firm_name}</p>
        {firm.services.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {firm.services.map((service) => (
              <span key={service} className={PILL}>
                {service}
              </span>
            ))}
          </div>
        ) : null}
        {host ? (
          <a
            href={firm.website as string}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1 font-mono text-xs text-zinc-500 hover:text-zinc-900 hover:underline hover:underline-offset-2 md:mt-0 md:min-h-0 md:justify-end dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {truncate(host, 300)}
            <ArrowUpRight aria-hidden className="h-[13px] w-[13px]" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function FirmsList({ firms }: { firms: PublicFirm[] }) {
  const listed = firms.filter((f) => f.services.length > 0).length;
  return (
    <div className="relative mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <p className={MONO_LABEL}>
        <Link href="/audits" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          Security audits
        </Link>
      </p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Ava Labs audit program · the whitelist
      </p>
      <h1 className="v2-display mt-4 text-5xl text-zinc-950 dark:text-zinc-50 sm:text-6xl">
        {firms.length} vetted firms<span className="text-brand">.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-[#A2AFB2]">
        Every firm below is on the Ava Labs audit whitelist. One request reaches all of them, or
        only the ones you choose.
      </p>
      <div className="mt-6">
        <Link
          href="/audits/new"
          className="audits-sweep inline-flex h-12 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors"
        >
          Request quotes
        </Link>
      </div>

      {firms.length === 0 ? (
        <div className="mt-12 rounded-xl border border-zinc-200 px-5 py-10 text-center dark:border-white/10">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No firms are listed right now.</p>
        </div>
      ) : (
        <>
          <div className="mt-12 rounded-xl border border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-white/10">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Whitelisted firms · A to Z
              </p>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                {listed > 0 ? `${listed} of ${firms.length} list their services` : "services not listed yet"}
              </p>
            </div>
            {firms.map((firm) => (
              <FirmRow key={firm.id} firm={firm} />
            ))}
          </div>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
            Firms join the whitelist after Ava Labs&apos; security review · each firm lists its own services · firms that leave the program drop off this page
          </p>
        </>
      )}
    </div>
  );
}
