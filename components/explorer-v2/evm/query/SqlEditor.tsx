"use client";

/* The SQL under a Query answer, as an editor: the text colored as
   ClickHouse reads it, line numbers, the line an error points at, and the
   chain's tables beside it (SqlSchema.tsx). A real textarea holds the
   text, the caret and the selection; its own text is clear, and a colored
   copy lies under it in the same font, moved as the textarea scrolls. */

import { useId, useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { errorPosition, tokenize, type SqlTokenKind } from "@/lib/explorer-query/sql-tokens";
import { SchemaFold, SchemaSide, useSchema } from "./SqlSchema";

/** the font the textarea, the colored copy and the gutter share, with whole-pixel lines so the three stay level.
    16px on a phone, where iOS zooms into a smaller box */
const TYPE = "font-mono text-[16px] leading-[var(--lh)] [--lh:24px] [font-variant-ligatures:none] [tab-size:2] md:text-[12px] md:[--lh:20px]";

/** a token's color; weight and slant stay the same, so no glyph changes width under the caret */
const INK: Record<SqlTokenKind, string> = {
  keyword: "text-violet-700 dark:text-violet-300",
  function: "text-sky-700 dark:text-sky-300",
  string: "text-emerald-700 dark:text-emerald-400",
  number: "text-amber-700 dark:text-amber-400",
  comment: "text-zinc-500",
  macro: "text-fuchsia-700 dark:text-fuchsia-300",
  punct: "text-zinc-600 dark:text-zinc-400",
  ident: "",
  text: "",
};
/** a name in backticks or double quotes */
const QUOTED = "text-teal-700 dark:text-teal-300";
const STRUCK = "underline decoration-[#E6212F] decoration-wavy underline-offset-[3px]";

const INDENT = "  ";

/** types text over the selection as the keyboard would, so undo steps back through it */
function typeAt(el: HTMLTextAreaElement, text: string, onChange: (value: string) => void) {
  el.focus();
  // execCommand keeps the textarea's own undo history; a browser without it gets the text set in place
  if (document.execCommand("insertText", false, text)) return;
  el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
  onChange(el.value);
}

/** Tab: two spaces at the caret, or in front of every line the selection touches */
function indent(el: HTMLTextAreaElement, onChange: (value: string) => void) {
  const { selectionStart: from, selectionEnd: to, value } = el;
  if (from === to) return typeAt(el, INDENT, onChange);
  const start = value.lastIndexOf("\n", from - 1) + 1;
  const block = value.slice(start, to).replace(/^/gm, INDENT);
  el.setSelectionRange(start, to);
  typeAt(el, block, onChange);
  el.setSelectionRange(start, start + block.length);
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  busy = false,
  error,
  chainId,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Cmd or Ctrl + Enter; not called while busy */
  onRun: () => void;
  busy?: boolean;
  /** the guard's or ClickHouse's message for the last run */
  error?: string | null;
  /** what the query route takes: a chain id, 1 or 5 for the P-Chain, or the network's slug */
  chainId: string | number;
  className?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const copy = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const hint = useId();
  const alert = useId();
  const schema = useSchema(chainId);

  const lines = useMemo(() => value.split("\n"), [value]);
  // read against the text as it is now: an edit above the place moves the mark with it, and a fix clears it
  const mark = useMemo(() => (error ? errorPosition(error, value) : null), [error, value]);
  const spans = useMemo(() => {
    const struck = mark?.col ? lines.slice(0, mark.line - 1).reduce((n, l) => n + l.length + 1, 0) + mark.col - 1 : -1;
    let at = 0;
    return tokenize(value).map((t) => {
      const from = at;
      at += t.text.length;
      const ink = t.kind === "ident" && /^[`"]/.test(t.text) ? QUOTED : INK[t.kind];
      return { text: t.text, className: cn(ink, struck >= from && struck < at && t.text.trim() && STRUCK) };
    });
  }, [value, lines, mark]);

  /** the colored copy and the gutter go where the textarea scrolled */
  const follow = () => {
    const el = box.current;
    if (!el) return;
    if (copy.current) copy.current.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;
    if (gutter.current) gutter.current.style.transform = `translateY(${-el.scrollTop}px)`;
  };
  // a new text can move the textarea's scroll with no scroll event
  useLayoutEffect(follow, [value]);

  const pick = (name: string) => {
    if (box.current) typeAt(box.current, name, onChange);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)} aria-busy={busy}>
      {/* from lg the editor is as tall as the schema beside it */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3">
        {schema && <SchemaFold tables={schema} onPick={pick} />}
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-colors focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-100">
          <div aria-hidden className="relative w-11 shrink-0 select-none overflow-hidden border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div ref={gutter} className={cn(TYPE, "absolute inset-x-0 top-0 py-2 text-right tabular-nums text-zinc-400 dark:text-zinc-600")}>
              {lines.map((_, i) => (
                <div key={i} className={cn("pr-2", i + 1 === mark?.line && "bg-[#E6212F]/10 text-[#c11824] shadow-[inset_2px_0_0_#E6212F] dark:text-[#ff6b73]")}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-w-0 flex-1">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <pre ref={copy} className={cn(TYPE, "relative m-0 w-max min-w-full whitespace-pre px-3 py-2 text-zinc-900 dark:text-zinc-100")}>
                {mark && <span className="absolute inset-x-0 h-[var(--lh)] bg-[#E6212F]/[0.07]" style={{ top: `calc(0.5rem + ${mark.line - 1} * var(--lh))` }} />}
                {spans.map((s, i) => (
                  <span key={i} className={s.className}>
                    {s.text}
                  </span>
                ))}
                {"\n"}
              </pre>
            </div>
            <textarea
              ref={box}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={follow}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!busy) onRun();
                } else if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                  indent(e.currentTarget, onChange);
                } else if (e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
              rows={Math.min(18, Math.max(5, lines.length + 1))}
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              aria-label="SQL"
              aria-describedby={hint}
              aria-invalid={error ? true : undefined}
              aria-errormessage={error ? alert : undefined}
              className={cn(
                TYPE,
                "relative block w-full resize-y lg:min-h-full overflow-auto whitespace-pre bg-transparent px-3 py-2 text-transparent caret-zinc-900 outline-none selection:bg-sky-500/25 dark:caret-zinc-50",
              )}
            />
          </div>
        </div>
        {schema && <SchemaSide tables={schema} onPick={pick} />}
      </div>
      {error && (
        <p id={alert} role="alert" className="font-mono text-[12px] leading-relaxed text-[#c11824] [overflow-wrap:anywhere] dark:text-[#ff6b73]">
          {mark && <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.18em]">Line {mark.line}</span>}
          {error}
        </p>
      )}
      <p id={hint} className="hidden font-mono text-[10px] tracking-[0.04em] text-zinc-500 md:block dark:text-zinc-400">
        Ctrl or Cmd + Enter runs the query. Tab indents. Esc leaves the editor.
      </p>
    </div>
  );
}
