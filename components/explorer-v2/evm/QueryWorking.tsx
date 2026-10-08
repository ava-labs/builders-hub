"use client";

import { ArrowUp, ChevronsUpDown } from "lucide-react";
import l1ChainsData from "@/constants/l1-chains.json";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { networkAsked } from "@/components/explorer-v2/network/ask-route";
import { NETWORK_SLUG } from "@/lib/explorer-query/target";
import { cn } from "@/lib/utils";
import { FILTER_MARK, WRITING } from "./query-client";
import { QueryLoader } from "./QueryLoader";

/* The Query page's question area, and the page's first frame while it
   asks. The page draws that frame from ?q before its first answer event;
   a search box's shell draws the same frame on the frame Enter lands
   (query-asking.tsx), while the Query page is still on its way. Both use
   the parts below, so the swap from one to the other shows nothing. */

/** the P-Chain Query page's column, inside the P-Chain shell */
export const PCHAIN_COLUMN = "mx-auto w-full max-w-[90rem] px-5 pb-24 pt-2 md:px-6";

/** what the SQL editor reads, as its hint names it */
export function sqlScopeOf(c: { kind: "evm" | "pchain"; chainId: string | number; chainSlug?: string }): string {
  if (c.kind === "pchain") return `One SELECT over the P-Chain tables (decoded_p_txs, the UTXO and snapshot tables), with chain_id = ${c.chainId}. At most 2,000 rows.`;
  const tables = "One SELECT over raw_blocks, raw_txs, raw_logs or raw_traces";
  return c.chainSlug === NETWORK_SLUG ? `${tables}, which hold every chain's rows, and chain_names. At most 2,000 rows.` : `${tables}, with chain_id = ${c.chainId}. At most 2,000 rows.`;
}

/** the network picker's trigger */
export const PICK = "group flex w-fit items-center gap-2 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100";

const CCHAIN_LOGO = (l1ChainsData as { slug: string; chainLogoURI?: string }[]).find((c) => c.slug === "c-chain")?.chainLogoURI;

/** what an empty prompt box offers to ask */
export function placeholderOf(kind: "evm" | "pchain", chainName: string): string {
  return kind === "pchain" ? "Ask the P-Chain about validators, staking, delegations, L1s or supply" : `Ask ${chainName} about its transactions, gas, contracts or tokens`;
}

/** a chain's mark in the network picker: its logo, or the Avalanche mark for all chains at once */
export function ChainMark({ logo, all, className }: { logo?: string; all?: boolean; className: string }) {
  // the mark rides the theme, as on the subnav's All Networks
  if (all) return <AvalancheLogo className={cn(className, "text-zinc-900 dark:text-zinc-100 [&_path]:fill-current")} />;
  if (logo) return <img src={logo} alt="" className={cn(className, "rounded-full object-contain")} />;
  return <span className={cn(className, "rounded-full border border-zinc-200 dark:border-zinc-800")} />;
}

/** the network picker's face: the chain that answers a question naming none */
export function PickFace({ label, logo, all }: { label: string; logo?: string; all?: boolean }) {
  return (
    <>
      <span>Answering from</span>
      {(logo || all) && <ChainMark logo={logo} all={all} className="h-4 w-4 shrink-0" />}
      <span className="font-bold text-zinc-900 dark:text-zinc-100">{label}</span>
      <span className="text-zinc-300 dark:text-zinc-600">· any chain you name</span>
      <ChevronsUpDown className="h-3 w-3 shrink-0" />
    </>
  );
}

/** the thread: one crumb per question, the newest darkest; New question once an answer stands */
export function ThreadLine({ prompts, onNew }: { prompts: string[]; onNew?: () => void }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[11px]">
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-zinc-400 dark:text-zinc-500">
        {prompts.map((p, i) => (
          <span key={i} className="flex items-baseline gap-2">
            {i > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
            <span className={cn(i === prompts.length - 1 && "text-zinc-700 dark:text-zinc-200")}>{p.split(FILTER_MARK)[0]}</span>
          </span>
        ))}
      </span>
      {onNew && (
        <button type="button" onClick={onNew} className="shrink-0 uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
          New question
        </button>
      )}
    </div>
  );
}

/** the prompt box: Enter sends, Shift+Enter breaks the line, Escape lets go. Without onChange it only shows */
export function PromptBox({
  value,
  placeholder,
  label,
  disabled = false,
  autoFocus,
  inputRef,
  onChange,
  onSend,
}: {
  value: string;
  placeholder: string;
  /** the send button's name */
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  onChange?: (value: string) => void;
  onSend?: () => void;
}) {
  return (
    <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-[0_8px_24px_-16px_rgba(24,24,27,0.3)] transition-colors focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
      <textarea
        ref={inputRef}
        value={value}
        readOnly={!onChange && !disabled}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend?.();
          } else if (e.key === "Escape") {
            e.currentTarget.blur();
          }
        }}
        rows={1}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        className="max-h-40 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 font-mono text-[13px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-600"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

/** a Query page's first frame while it asks: the question, the box held while the answer is written, the loader */
export function QueryWorking({ question, kind, chainName, scope }: { question: string; kind: "evm" | "pchain"; chainName: string; scope?: "network" }) {
  const all = scope === "network" && networkAsked(question);
  return (
    <>
      {/* the network page's picker: All chains for a question about every chain, else the C-Chain until the page reads which chain the question names */}
      {scope === "network" && (
        <div className="mb-6">
          <div className={PICK}>{all ? <PickFace label="All chains" all /> : <PickFace label="C-Chain" logo={CCHAIN_LOGO} />}</div>
        </div>
      )}
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <ThreadLine prompts={[question]} />
          <PromptBox value="" disabled placeholder={placeholderOf(kind, all ? "every chain" : chainName)} label="Ask" />
          <QueryLoader status={`${WRITING} · 0 s`} />
        </section>
      </div>
    </>
  );
}
