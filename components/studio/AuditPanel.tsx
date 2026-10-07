"use client";

import { useState } from "react";
import Link from "next/link";
import { Board, BoardHeader, EmptyRow, MUTED, SectionHeader, StatCell, StatStrip, idInk } from "@/components/explorer-v2/ui";
import { OWASP_2026, SEVERITIES } from "@/lib/studio/audit/types";
import { cn } from "@/lib/utils";
import { api, errorText, type Finding, type ProjectOverview } from "./api";
import { Button, INPUT, Notice, Pill, SEVERITY_TONE, timeAgo } from "./ui";

function FindingRow({
  finding,
  acknowledgement,
  onAcknowledge,
}: {
  finding: Finding;
  acknowledgement?: { reason: string };
  onAcknowledge?: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Pill>
        <span className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">{finding.title}</span>
        <span className={cn(MUTED, "text-[11px]")} title={OWASP_2026[finding.category]}>
          OWASP {finding.category}
        </span>
        {acknowledgement && <Pill tone="neutral">acknowledged</Pill>}
      </div>
      <span className={cn(MUTED, "text-[11px]")}>
        {finding.file}:{finding.line}
        {finding.contract ? ` · ${finding.contract}${finding.function ? `.${finding.function}` : ""}` : ""}
      </span>
      <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">{finding.message}</p>
      <pre className="overflow-x-auto bg-zinc-50 px-3 py-2 font-mono text-[11.5px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{finding.snippet}</pre>
      <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Fix </span>
        {finding.recommendation}
      </p>
      {acknowledgement && <Notice>Acknowledged: {acknowledgement.reason}</Notice>}
      {onAcknowledge && !acknowledgement && (
        <div className="flex flex-col gap-2">
          {open ? (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why this cannot be exploited in this contract (at least 10 characters)"
                className={cn(INPUT, "h-auto py-2")}
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
            </>
          ) : (
            <div>
              <Button variant="ghost" onClick={() => setOpen(true)} className="px-0">
                Acknowledge with a reason
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditPanel({ overview, onBuild, building, onChanged }: { overview: ProjectOverview; onBuild: () => void; building: boolean; onChanged: () => void }) {
  const { build, audit, project } = overview;
  const acknowledged = new Map((audit?.acknowledged ?? []).map((a) => [a.fingerprint, a]));
  const errors = build?.diagnostics.filter((d) => d.severity === "error") ?? [];
  const warnings = build?.diagnostics.filter((d) => d.severity === "warning") ?? [];

  const acknowledge = async (fingerprint: string, reason: string) => {
    await api(`/api/studio/projects/${project.id}/audits/${audit!.id}/acknowledge`, { method: "POST", json: { fingerprint, reason } });
    onChanged();
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader
          label="Build"
          action={
            <Button onClick={onBuild} busy={building}>
              Build and audit
            </Button>
          }
        />
        {!build ? (
          <Notice>No build yet. Build compiles contracts/ with solc 0.8.28 and the pinned OpenZeppelin and CCIP sources, then audits the result.</Notice>
        ) : (
          <Board>
            <BoardHeader
              label={`${build.ok ? "Compiled" : "Failed"} · ${build.compiler || "solc"}`}
              action={<span className={cn(MUTED, "text-[11px]")}>{timeAgo(build.created_at)}</span>}
            />
            {errors.length === 0 && warnings.length === 0 && <EmptyRow>No errors or warnings.</EmptyRow>}
            {[...errors, ...warnings].map((d, i) => (
              <div key={i} className="flex flex-col gap-1 px-5 py-2.5 md:px-6">
                <span className="flex items-center gap-2">
                  <Pill tone={d.severity === "error" ? "bad" : "warn"}>{d.severity}</Pill>
                  {d.file && (
                    <span className={cn(MUTED, "text-[11px]")}>
                      {d.file}:{d.line}
                    </span>
                  )}
                </span>
                <span className="text-[13px] text-zinc-800 dark:text-zinc-200">{d.message}</span>
              </div>
            ))}
            {build.contracts.length > 0 && (
              <div className={cn(MUTED, "px-5 py-2.5 text-[11px] md:px-6")}>
                {build.contracts.map((c) => `${c.name}${c.deployable ? "" : " (not deployable)"}`).join(" · ")}
              </div>
            )}
          </Board>
        )}
      </section>

      {audit && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            label="Audit"
            action={<Pill tone={audit.passed ? "good" : "bad"}>{audit.passed ? "deploys allowed" : "deploys blocked"}</Pill>}
          />
          <StatStrip cols={5}>
            {SEVERITIES.map((s) => (
              <StatCell key={s} label={s}>
                <span className={cn("font-mono text-xl tabular-nums", audit.counts[s] > 0 && (s === "critical" || s === "high") ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50")}>
                  {audit.counts[s]}
                </span>
              </StatCell>
            ))}
          </StatStrip>
          <p className={cn(MUTED, "text-[11px]")}>
            {audit.tool_version && `Detectors v${audit.tool_version}, mapped to the OWASP Smart Contract Top 10 (2026). `}
            Critical and high findings block testnet deploys; medium ones also block production. Static analysis is not a full audit:{" "}
            <Link href="/audits/new" className={idInk}>
              request a professional audit
            </Link>{" "}
            before real value is at stake.
          </p>
          <Board>
            {audit.findings.length === 0 ? (
              <EmptyRow>No findings.</EmptyRow>
            ) : (
              audit.findings.map((f) => (
                <FindingRow
                  key={f.fingerprint}
                  finding={f}
                  acknowledgement={acknowledged.get(f.fingerprint)}
                  onAcknowledge={["critical", "high", "medium"].includes(f.severity) ? (reason) => acknowledge(f.fingerprint, reason) : undefined}
                />
              ))
            )}
          </Board>
        </section>
      )}

      {audit && audit.review.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Review checklist" />
          <Board>
            {audit.review.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-2.5 md:px-6">
                <Pill tone={item.status === "pass" ? "good" : item.status === "fail" ? "bad" : "neutral"}>{item.status}</Pill>
                <span className="min-w-0">
                  <span className="font-mono text-[12px] text-zinc-900 dark:text-zinc-50">{item.id}</span>
                  <span className="block text-[12.5px] text-zinc-500 dark:text-zinc-400">{item.evidence}</span>
                </span>
              </div>
            ))}
          </Board>
        </section>
      )}
    </div>
  );
}
