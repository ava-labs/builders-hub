"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { Board, BoardHeader, MUTED, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { BLOCKING_SEVERITIES, OWASP_2026, SEVERITIES, type Severity } from "@/lib/studio/audit/types";
import { cn } from "@/lib/utils";
import { api, errorText, type Finding, type ProjectOverview } from "./api";
import { codeReference, referenceInChat } from "./chat-reference";
import { BONE, Handoff, HowItWorks } from "./PublishSite";
import { Appear, Bone, Button, EmptyState, INPUT, LABEL, Notice, timeAgo } from "./ui";

/* Severity is a quiet tone: a dot and an inked word, red for what blocks, amber for what blocks production. */
const SEVERITY_INK: Record<Severity, string> = {
  critical: "text-red-700 dark:text-red-300",
  high: "text-red-700 dark:text-red-300",
  medium: "text-amber-700 dark:text-amber-300",
  low: "text-zinc-600 dark:text-zinc-300",
  info: "text-zinc-500 dark:text-zinc-400",
};
const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-red-600 dark:bg-red-400",
  high: "bg-red-600 dark:bg-red-400",
  medium: "bg-amber-400",
  low: "bg-zinc-400 dark:bg-zinc-500",
  info: "bg-zinc-300 dark:bg-zinc-600",
};

/** A phone's five count cells are too narrow for the full words. */
const SEVERITY_SHORT: Record<Severity, string> = { critical: "crit", high: "high", medium: "med", low: "low", info: "info" };

/** Up to this many findings, the severity marks in the list say it all; the counts fold into the meta line. */
const COUNT_STRIP_FROM = 7;

const BOX = "border-x border-t border-zinc-200 dark:border-zinc-800";
const MARK = "inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]";
const INLINE_LABEL = "mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";
const WRITE_PROMPT = "Write a contract for this project in contracts/.";

function SeverityMark({ severity }: { severity: Severity }) {
  return (
    <span className={cn(MARK, "w-[74px]", SEVERITY_INK[severity])}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[severity])} />
      {severity}
    </span>
  );
}

const isBlocking = (f: Finding) => BLOCKING_SEVERITIES.includes(f.severity);
const where = (f: Finding) => `\`${f.file}\` line ${f.line}`;

function FindingRow({
  finding,
  acknowledgement,
  onAcknowledge,
  defaultOpen,
}: {
  finding: Finding;
  acknowledgement?: { reason: string };
  onAcknowledge?: (reason: string) => Promise<void>;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
      >
        <ChevronRight className={cn("mt-[3px] h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform", expanded && "rotate-90")} />
        <span className={cn("flex min-w-0 flex-1 flex-col gap-1", acknowledgement && "opacity-60")}>
          <span className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <SeverityMark severity={finding.severity} />
            <span className="min-w-0 text-[14px] font-medium text-zinc-900 dark:text-zinc-50">{finding.title}</span>
          </span>
          <span className={cn(MUTED, "text-[11px] sm:pl-[86px]")}>
            {finding.file}:{finding.line}
            {finding.contract ? ` · ${finding.contract}${finding.function ? `.${finding.function}` : ""}` : ""}
            <span title={OWASP_2026[finding.category]}> · OWASP {finding.category}</span>
          </span>
        </span>
        {acknowledgement && (
          <span className={cn(MARK, "mt-0.5 text-zinc-500 dark:text-zinc-400")}>
            <Check className="h-3 w-3" /> Acknowledged
          </span>
        )}
      </button>
      {expanded && (
        <Appear className="flex flex-col gap-3 pb-4 pl-[46px] pr-5 sm:pl-[132px] md:pl-[136px] md:pr-6">
          <p className="max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{finding.message}</p>
          <pre className="overflow-x-auto border-l-2 border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[11.5px] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{finding.snippet}</pre>
          <p className="max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            <span className={INLINE_LABEL}>Fix</span>
            {finding.recommendation}
          </p>
          {acknowledgement && (
            <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className={INLINE_LABEL}>Reason</span>
              {acknowledgement.reason}
            </p>
          )}
          {!acknowledgement && open && onAcknowledge ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why this cannot be exploited in this contract (at least 10 characters)"
                className={cn(INPUT, "h-auto py-2 font-sans text-[13px]")}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  busy={busy}
                  disabled={reason.trim().length < 10}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await onAcknowledge(reason.trim());
                    } catch (e) {
                      setError(errorText(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Acknowledge
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
              {error && <Notice tone="bad">{error}</Notice>}
            </div>
          ) : (
            !acknowledgement && (
              <div className="-ml-2 flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  className="px-2"
                  onClick={() =>
                    referenceInChat(
                      `Fix the audit finding "${finding.title}" (${finding.severity}). ${finding.recommendation}\n\n${codeReference(finding.file, finding.line, finding.line, finding.snippet)}`,
                    )
                  }
                >
                  Ask Studio to fix this
                </Button>
                {onAcknowledge && (
                  <Button variant="ghost" className="px-2" onClick={() => setOpen(true)}>
                    Acknowledge with a reason
                  </Button>
                )}
              </div>
            )
          )}
        </Appear>
      )}
    </div>
  );
}

/** The verdict board and three finding rows, swept while the first build runs. */
function AuditSkeleton() {
  return (
    <div role="status" aria-label="Building and auditing" className="flex flex-col gap-3">
      <Board className={BOX}>
        <div className="flex items-start gap-3 px-5 py-4 md:px-6">
          <Bone className={cn(BONE, "mt-1.5 h-2 w-2 shrink-0")} />
          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Bone className={cn(BONE, "h-4 w-56 max-w-full")} />
            <Bone className={cn(BONE, "h-2.5 w-72 max-w-full")} delay={0.04} />
            <Bone className={cn(BONE, "h-2.5 w-40")} delay={0.08} />
          </span>
        </div>
      </Board>
      <Board className={BOX}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-3.5 md:px-6">
            <span className="flex items-center gap-3">
              <Bone className={cn(BONE, "h-3 w-3")} delay={0.12 + i * 0.04} />
              <Bone className={cn(BONE, "h-2.5 w-16")} delay={0.12 + i * 0.04} />
              <Bone className={cn(BONE, "h-3.5 w-64 max-w-full")} delay={0.12 + i * 0.04} />
            </span>
            <Bone className={cn(BONE, "ml-6 h-2.5 w-44 sm:ml-[110px]")} delay={0.14 + i * 0.04} />
          </div>
        ))}
      </Board>
    </div>
  );
}

export function AuditPanel({ overview, onBuild, building, onChanged }: { overview: ProjectOverview; onBuild: () => void; building: boolean; onChanged: () => void }) {
  const { build, audit, project } = overview;
  const acknowledged = new Map((audit?.acknowledged ?? []).map((a) => [a.fingerprint, a]));
  const errors = build?.diagnostics.filter((d) => d.severity === "error") ?? [];
  const warnings = build?.diagnostics.filter((d) => d.severity === "warning") ?? [];
  const hasContracts = overview.files.some((f) => f.path.startsWith("contracts/") && f.path.endsWith(".sol"));

  const acknowledge = async (fingerprint: string, reason: string) => {
    await api(`/api/studio/projects/${project.id}/audits/${audit!.id}/acknowledge`, { method: "POST", json: { fingerprint, reason } });
    onChanged();
  };

  const rank = (s: Severity) => SEVERITIES.indexOf(s);
  // Open findings first, the most severe at the top; acknowledged ones follow in the same order.
  const findings = [...(audit?.findings ?? [])].sort(
    (a, b) => Number(acknowledged.has(a.fingerprint)) - Number(acknowledged.has(b.fingerprint)) || rank(a.severity) - rank(b.severity),
  );
  const blocking = findings.filter((f) => isBlocking(f) && !acknowledged.has(f.fingerprint));
  const firstOpen = blocking[0]?.fingerprint;

  const askToFixAll = () =>
    referenceInChat(
      `Fix these audit findings, then build and audit again:\n${blocking.map((f, i) => `${i + 1}. ${f.title} (${f.severity}), ${where(f)}`).join("\n")}\n`,
    );
  const askToFixErrors = () =>
    referenceInChat(
      `Fix these compiler errors, then build and audit again:\n${errors.map((d, i) => `${i + 1}. ${d.file ? `\`${d.file}\` line ${d.line}: ` : ""}${d.message}`).join("\n")}\n`,
    );

  const compiler = build ? `solc ${build.compiler.split("+")[0] || build.compiler || "solc"}` : "";
  const deployable = build?.contracts.filter((c) => c.deployable) ?? [];
  const counted = audit ? SEVERITIES.filter((s) => audit.counts[s] > 0) : [];
  const countStrip = findings.length >= COUNT_STRIP_FROM;

  let body: React.ReactNode;
  if (!build && !building) {
    body = hasContracts ? (
      // On large screens the workspace header's Build and audit sits in view, so the pane points to it.
      <EmptyState
        icon={ShieldCheck}
        title="Not built yet"
        action={
          <span className="lg:hidden">
            <Button variant="secondary" onClick={onBuild}>
              Build and audit
            </Button>
          </span>
        }
      >
        <span className="hidden lg:inline">Press Build and audit, top right, to compile and audit contracts/.</span>
        <span className="lg:hidden">Build and audit compiles contracts/, then audits the result.</span>
      </EmptyState>
    ) : (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing to audit yet"
        action={
          <Button variant="secondary" onClick={() => referenceInChat(WRITE_PROMPT)}>
            Ask Studio to write a contract
          </Button>
        }
      >
        Add a Solidity file under contracts/ in the Files tab.
      </EmptyState>
    );
  } else {
    body = (
      // A build takes seconds, so its skeleton shows at once. A rebuild keeps the last results, dimmed, until the new
      // ones land in their place.
      <Handoff ready={build !== null} skeleton={<AuditSkeleton />} after={50}>
        {build && (
          <div aria-busy={building || undefined} className={cn("flex flex-col gap-3 transition-opacity duration-300 motion-reduce:transition-none", building && "opacity-50")}>
            {!build.ok && (
              <Notice tone="bad">
                <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <span>
                    The build failed with {errors.length} {errors.length === 1 ? "error" : "errors"}.
                  </span>
                  {errors.length > 0 && (
                    <Button className="self-start sm:self-auto" onClick={askToFixErrors}>
                      Ask Studio to fix
                    </Button>
                  )}
                </span>
              </Notice>
            )}

            {audit && (
              <Board className={BOX}>
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 md:px-6">
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    {audit.passed ? (
                      <Check className="mt-[3px] h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    )}
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-[16px] font-medium text-zinc-900 dark:text-zinc-50">
                        {!audit.passed
                          ? blocking.length > 0
                            ? `${blocking.length} ${blocking.length === 1 ? "finding blocks" : "findings block"} deploys`
                            : "Deploys blocked"
                          : findings.length === 0
                            ? "No findings"
                            : "Deploys allowed"}
                      </span>
                      {(!audit.passed || findings.length > 0) && (
                        <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
                          {!audit.passed ? "Fix them, or acknowledge each one with a reason." : "Nothing blocks a testnet deploy."}
                        </span>
                      )}
                      <span className={cn(MUTED, "pt-0.5 text-[11px] leading-relaxed")}>
                        {[
                          ...(countStrip ? [] : counted.map((s) => ({ key: s, text: `${audit.counts[s]} ${s}`, ink: s === "critical" || s === "high" ? "text-red-700 dark:text-red-300" : undefined, title: undefined }))),
                          { key: "solc", text: compiler, ink: undefined, title: undefined },
                          ...(build.contracts.length > 0
                            ? [{ key: "contracts", text: `${deployable.length} ${deployable.length === 1 ? "contract" : "contracts"}`, ink: undefined, title: build.contracts.map((c) => `${c.name}${c.deployable ? "" : " (not deployable)"}`).join(", ") }]
                            : []),
                          { key: "age", text: timeAgo(build.created_at), ink: undefined, title: undefined },
                        ].map((m, i, all) => (
                          // Each dot stays with the part before it, so a wrapped line never starts with one.
                          <Fragment key={m.key}>
                            <span title={m.title} className={cn("whitespace-nowrap", m.ink)}>
                              {m.text}
                              {i < all.length - 1 && <span className="text-zinc-400 dark:text-zinc-500">{"\u00a0·"}</span>}
                            </span>
                            {i < all.length - 1 && " "}
                          </Fragment>
                        ))}
                      </span>
                    </span>
                  </span>
                  {!audit.passed && blocking.length > 0 && (
                    <Button onClick={askToFixAll} className="self-start max-sm:ml-7">
                      Ask Studio to fix
                    </Button>
                  )}
                </div>
                {countStrip && (
                  <div className="grid grid-cols-5 divide-x divide-zinc-200 dark:divide-zinc-800">
                    {SEVERITIES.map((s) => (
                      <div key={s} className="flex min-w-0 flex-col gap-1 px-2 py-3 sm:px-5">
                        <span className="truncate font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                          <span className="sm:hidden">{SEVERITY_SHORT[s]}</span>
                          <span className="hidden sm:inline">{s}</span>
                        </span>
                        <span
                          className={cn(
                            "font-mono text-lg tabular-nums",
                            audit.counts[s] === 0
                              ? "text-zinc-300 dark:text-zinc-700"
                              : s === "critical" || s === "high"
                                ? "text-red-700 dark:text-red-300"
                                : "text-zinc-900 dark:text-zinc-50",
                          )}
                        >
                          {audit.counts[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Board>
            )}

            {findings.length > 0 && (
              <Board className={BOX}>
                {findings.map((f) => (
                  <FindingRow
                    key={f.fingerprint}
                    finding={f}
                    defaultOpen={f.fingerprint === firstOpen}
                    acknowledgement={acknowledged.get(f.fingerprint)}
                    onAcknowledge={["critical", "high", "medium"].includes(f.severity) ? (reason) => acknowledge(f.fingerprint, reason) : undefined}
                  />
                ))}
              </Board>
            )}

            {(errors.length > 0 || warnings.length > 0) && (
              <Board className={BOX}>
                <BoardHeader
                  label={`Compiler · ${[errors.length && `${errors.length} ${errors.length === 1 ? "error" : "errors"}`, warnings.length && `${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}`].filter(Boolean).join(" · ")}`}
                  action={<span className={cn(MUTED, "hidden whitespace-nowrap text-[11px] sm:inline")}>{compiler}</span>}
                />
                {[...errors, ...warnings].map((d, i) => (
                  <div key={i} className="flex flex-col gap-1 px-5 py-2.5 md:px-6">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn(MARK, d.severity === "error" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300")}>
                        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", d.severity === "error" ? "bg-red-600 dark:bg-red-400" : "bg-amber-400")} />
                        {d.severity}
                      </span>
                      {d.file && (
                        <span className={cn(MUTED, "min-w-0 truncate text-[11px]")} title={`${d.file}:${d.line}`}>
                          {d.file}:{d.line}
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{d.message}</span>
                  </div>
                ))}
              </Board>
            )}

            {build.ok && !audit && (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Compiled with {compiler}. Run it again to audit the result.</p>
            )}
          </div>
        )}
      </Handoff>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader
          label="Audit"
          action={
            building ? (
              // Said at every width: on a phone the header's busy button is screens away.
              <span role="status" className={cn(LABEL, "inline-flex shrink-0 items-center gap-2")}>
                <Loader2 aria-hidden className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                Building and auditing…
              </span>
            ) : build ? (
              <Button variant="secondary" className="h-7 lg:hidden" onClick={onBuild}>
                Run again
              </Button>
            ) : undefined
          }
        />
        {body}
      </section>

      {audit && audit.review.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Review checklist" />
          <Board className="border-t border-zinc-200 dark:border-zinc-800">
            {audit.review.map((item) => (
              <div key={item.id} className="flex items-start gap-4 px-5 py-2.5 md:px-6">
                <span
                  className={cn(
                    MARK,
                    "mt-0.5 w-12",
                    item.status === "pass" ? "text-emerald-700 dark:text-emerald-300" : item.status === "fail" ? "text-amber-700 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-1.5 w-1.5 rounded-full", item.status === "pass" ? "bg-emerald-500" : item.status === "fail" ? "bg-amber-400" : "bg-zinc-300 dark:bg-zinc-600")}
                  />
                  {item.status === "na" ? "n/a" : item.status}
                </span>
                <span className="min-w-0">
                  <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-50">{item.id}</span>
                  <span className="block text-[12.5px] text-zinc-500 dark:text-zinc-400">{item.evidence}</span>
                </span>
              </div>
            ))}
          </Board>
        </section>
      )}

      {(build || hasContracts) && (
        <HowItWorks>
          <p>
            {audit?.tool_version ? `Studio's detectors (v${audit.tool_version})` : "Studio's detectors"} map each finding to the OWASP Smart Contract Top 10 (2026). Critical and high findings block testnet deploys,
            and medium ones also block production.
          </p>
          <p>
            Static analysis is not a full audit.{" "}
            <Link href="/audits/new" className={idInk}>
              Request a professional audit
            </Link>{" "}
            before real value is at stake.
          </p>
        </HowItWorks>
      )}
    </div>
  );
}
