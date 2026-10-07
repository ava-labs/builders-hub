"use client";

import { ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILTER_MARK } from "./query-client";

/* The Query page's question area: the prompt box, the thread line over
   it, and the network picker's face. */

/** the P-Chain Query page's column, inside the P-Chain shell */
export const PCHAIN_COLUMN = "mx-auto w-full max-w-[90rem] px-5 pb-24 pt-2 md:px-6";

/** the network picker's trigger */
export const PICK = "group flex w-fit items-center gap-2 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100";

/** what an empty prompt box offers to ask */
export function placeholderOf(kind: "evm" | "pchain", chainName: string): string {
  return kind === "pchain" ? "Ask the P-Chain about validators, staking, delegations, L1s or supply" : `Ask ${chainName} about its transactions, gas, contracts or tokens`;
}

/** the network picker's face: the chain that answers a question naming none */
export function PickFace({ label, logo }: { label: string; logo?: string }) {
  return (
    <>
      <span>Answering from</span>
      {logo && <img src={logo} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />}
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
