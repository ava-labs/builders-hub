import { hostOf } from "@/components/audits/shared/format";

interface QuoteDocLinkProps {
  url: string | null;
  /**
   * footer · the reading views' action row: "Read the proposal ↗" + host,
   *          muted "No proposal attached" when the firm sent none.
   * cell   · the table's compact "doc ↗" with the URL on title; renders
   *          nothing when absent (an empty cell IS the absence signal there).
   * meta   · inline "proposal ↗" for mono meta lines (winner card).
   */
  variant?: "footer" | "cell" | "meta";
}

/**
 * The ONE renderer for a quote's proposal link (round-5 V5-1): rows, cards,
 * table and the winner card all use it, so the next surface cannot drift the
 * way deal_doc_url did. Values are schema-guaranteed http(s) at intake
 * (httpsUrl in types/audits.ts); the host is shown so the reader knows where
 * the click goes before taking it.
 */
export function QuoteDocLink({ url, variant = "footer" }: QuoteDocLinkProps) {
  if (variant === "footer") {
    if (!url) {
      return (
        <span className="text-[12.5px] text-zinc-400 dark:text-zinc-500">No proposal attached</span>
      );
    }
    const host = hostOf(url);
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[13.5px] font-semibold underline underline-offset-[3px] hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Read the proposal ↗
        </a>
        {host ? (
          <span className="break-all font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
            {host}
          </span>
        ) : null}
      </span>
    );
  }

  if (!url) return null;

  if (variant === "cell") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={url}
        className="whitespace-nowrap font-mono text-xs underline underline-offset-[3px] hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        doc ↗
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      proposal ↗
    </a>
  );
}
