"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Profile primitives, in the site's sheet idiom: square hairline       */
/* groups, a mono label strip on a quiet tint, one row per setting,     */
/* Geist for words and Geist Mono for data. An account page reads as    */
/* a list of grouped rows (Apple Account, Meta Accounts Center); the    */
/* brand sets the look of each part.                                    */
/* ------------------------------------------------------------------ */

/** the focus ring: the site's blue, solid, so it keeps 3:1 on the page in both themes */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2] dark:focus-visible:ring-[#5b9bff] focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950";

/** a mono label: group strips, section eyebrows, small data */
export const MONO_LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.18em]";

/** the scroll behavior for a script scroll: a set CSS scroll-behavior does not reach it */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/* ------------------------------------------------------------------ */
/* Section header: the eyebrow names the area, the heading the page.    */
export function SectionHeader({
  eyebrow,
  title,
  action,
  id,
}: {
  eyebrow: string;
  title: string;
  /** the page's one main action */
  action?: React.ReactNode;
  /** the heading id, for aria-labelledby on the section */
  id?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div className="min-w-0">
        <p className={cn(MONO_LABEL, "text-zinc-500 dark:text-zinc-400")}>{eyebrow}</p>
        <h1 id={id} className="v2-heading mt-2 text-[28px] text-zinc-900 sm:text-[32px] dark:text-zinc-50">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Group: a square hairline box with its label fused into a top strip.  */
export function Group({
  label,
  action,
  children,
  className,
  divide = true,
}: {
  label: string;
  /** the group's one action, at the right of the strip */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  divide?: boolean;
}) {
  const labelId = React.useId();
  return (
    <section
      aria-labelledby={labelId}
      className={cn("border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950", className)}
    >
      <div className="flex min-h-10 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 id={labelId} className={cn(MONO_LABEL, "min-w-0 truncate text-zinc-500 dark:text-zinc-400")}>
          {label}
        </h2>
        {action}
      </div>
      <div className={cn(divide && "divide-y divide-zinc-200 dark:divide-zinc-800")}>{children}</div>
    </section>
  );
}

/** the gap between groups on a section page */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-6 sm:gap-8", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Row: one setting. The label owns a fixed column from sm up, and      */
/* stands over its control on a phone.                                  */
export function Row({
  label,
  htmlFor,
  hint,
  children,
  align = "center",
}: {
  label: React.ReactNode;
  /** the id of the control, so the label names it */
  htmlFor?: string;
  /** one short line under the control */
  hint?: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  const LabelTag = htmlFor ? "label" : "div";
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:gap-6 sm:px-5",
        align === "center" ? "sm:items-center" : "sm:items-start",
      )}
    >
      <LabelTag
        {...(htmlFor ? { htmlFor } : {})}
        className={cn(
          "shrink-0 text-[13px] font-medium text-zinc-500 sm:w-44 dark:text-zinc-400",
          align === "start" && "sm:pt-2.5",
        )}
      >
        {label}
      </LabelTag>
      <div className="min-w-0 flex-1">
        {children}
        {hint && <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
    </div>
  );
}

/** a row that is all content: a list item, an empty state, a note */
export function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3.5 sm:px-5", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
const FIELD =
  "w-full border border-zinc-500 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-500 transition-colors hover:border-zinc-700 focus-visible:border-[#0061E2] disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:border-zinc-400 dark:focus-visible:border-[#5b9bff] dark:disabled:bg-zinc-900";

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} {...rest} className={cn(FIELD, FOCUS, "h-10 px-3", className)} />;
  },
);

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return <textarea ref={ref} {...rest} className={cn(FIELD, FOCUS, "min-h-24 resize-y px-3 py-2.5", className)} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} {...rest} className={cn(FIELD, FOCUS, "h-10 px-2.5", className)}>
        {children}
      </select>
    );
  },
);

/** an input with a fixed prefix (a host, an @) set in mono */
export const PrefixInput = React.forwardRef<
  HTMLInputElement,
  { prefix: string } & React.InputHTMLAttributes<HTMLInputElement>
>(function PrefixInput({ prefix, className, ...rest }, ref) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-stretch border border-zinc-500 bg-white transition-colors focus-within:border-[#0061E2] focus-within:ring-2 focus-within:ring-[#0061E2] focus-within:ring-offset-1 focus-within:ring-offset-white hover:border-zinc-700 dark:border-zinc-500 dark:bg-zinc-950 dark:hover:border-zinc-400 dark:focus-within:border-[#5b9bff] dark:focus-within:ring-[#5b9bff] dark:focus-within:ring-offset-zinc-950",
        className,
      )}
    >
      <span className="flex shrink-0 items-center border-r border-zinc-200 bg-zinc-50 px-2.5 font-mono text-[12px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {prefix}
      </span>
      <input
        ref={ref}
        {...rest}
        className="min-w-0 flex-1 bg-transparent px-3 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON: Record<ButtonVariant, string> = {
  // brand red block, as BrandButton's primary
  primary: "bg-[#E6212F] text-white hover:bg-[#B20F2A] disabled:bg-zinc-300 dark:disabled:bg-zinc-800",
  // the subnav's square chip: hairline, mono caps
  secondary:
    "border border-zinc-200 text-zinc-900 hover:border-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-100",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
  danger:
    "border border-zinc-200 text-[#E6212F] hover:border-[#E6212F] dark:border-zinc-800 dark:text-[#FF394A] dark:hover:border-[#FF394A]",
};

const BUTTON_BASE =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 px-3.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }
>(function Button({ variant = "secondary", busy = false, className, children, disabled, type, onClick, ...rest }, ref) {
  // busy is aria-disabled, not disabled: a disabled button drops the keyboard
  // focus to the page, so the user would lose their place while it works
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : onClick}
      {...rest}
      className={cn(BUTTON_BASE, BUTTON[variant], FOCUS, busy && "cursor-progress opacity-80", className)}
    >
      {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
});

/** a link set as a button; the arrow marks that it leaves the page */
export function LinkButton({
  href,
  children,
  variant = "secondary",
  arrow = true,
  className,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  arrow?: boolean;
  className?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          className={cn(
            "h-3 w-3 transition-transform group-hover:translate-x-0.5",
            variant === "primary" ? "text-white" : "text-[#E6212F]",
          )}
        />
      )}
    </>
  );
  const cls = cn("group", BUTTON_BASE, BUTTON[variant], FOCUS, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Switch: on is ink, off is a hairline track                           */
export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** the accessible name, when no <label htmlFor> names it */
  label?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked
          ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
          : "border-zinc-500 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-900",
        FOCUS,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-4 w-4 transition-transform",
          checked ? "translate-x-[22px] bg-white dark:bg-zinc-900" : "translate-x-[3px] bg-zinc-500 dark:bg-zinc-400",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Small parts                                                          */

/** a status mark: a filled square, the site's block motif */
export function StatusMark({ tone }: { tone: "ok" | "error" | "idle" | "warn" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2 w-2 shrink-0",
        tone === "ok" && "bg-emerald-500",
        tone === "error" && "bg-[#E6212F]",
        tone === "warn" && "bg-amber-500",
        tone === "idle" && "bg-zinc-300 dark:bg-zinc-700",
      )}
    />
  );
}

/** a tag in the mono voice: a network, a state */
export function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "red" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center border px-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]",
        tone === "plain" && "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
        tone === "red" && "border-[#E6212F]/40 text-[#E6212F] dark:text-[#FF394A]",
        tone === "blue" && "border-[#0061E2]/40 text-[#0061E2] dark:text-[#5b9bff]",
      )}
    >
      {children}
    </span>
  );
}

/** what a group shows when it has nothing: one line, one action */
export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-[14px] text-zinc-500 dark:text-zinc-400">{children}</p>
      {action}
    </div>
  );
}

/** placeholder rows while a group loads */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-14 items-center justify-between gap-6 px-4 sm:px-5">
          <div className="h-3 w-48 max-w-[60%] animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-3 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </div>
  );
}

/** a short error line in a group, with a retry */
export function ErrorLine({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <p className="text-[14px] text-[#E6212F] dark:text-[#FF394A]">{children}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** a field's error, tied to its control by id */
export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12px] text-[#E6212F] dark:text-[#FF394A]">
      {children}
    </p>
  );
}
