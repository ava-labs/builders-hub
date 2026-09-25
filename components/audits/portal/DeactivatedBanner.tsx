import { MONO_LABEL_SM } from "@/components/audits/shared/classes";

/**
 * Read-only notice for deactivated firms (round-3 N-4): history stays open,
 * new work does not. Amber = needs-action hue from the Foundations board;
 * dot + label so the state never rides on color alone.
 */
export function DeactivatedBanner() {
  return (
    <div className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-400/[0.06]">
      <p className={`${MONO_LABEL_SM} flex items-center gap-2 !text-amber-700 dark:!text-amber-400`}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Deactivated · read-only
      </p>
      <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">
        Past quotes and engagements stay on record and this portal stays open to review them. The
        firm no longer receives new requests and quoting is disabled · contact the program team to
        reactivate.
      </p>
    </div>
  );
}
