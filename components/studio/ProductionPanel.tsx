"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, ShieldCheck } from "lucide-react";
import { Board, BoardHeader, MUTED, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { cn } from "@/lib/utils";
import { ApiError, api, errorText, type BlueprintCard, type Gate, type ProjectOverview } from "./api";
import { BoardBone, HowItWorks, networkNamesOf } from "./Runner";
import { Appear, Bone, Button, EmptyState, Field, INPUT, Notice, timeAgo } from "./ui";

interface Preview {
  gates: Gate[];
  networks: Record<string, string>;
  unsupported: { role: string; network: string; reason: string }[];
}

/** The last gate check of each testnet deployment, so coming back to the tab paints it at once while it re-checks. */
const PREVIEWS = new Map<string, Preview>();

const GATE_ROW = "flex gap-3 px-5 py-3.5 md:px-6";

/** The mainnet chain ID field, inside the gate it clears. */
function MainnetL1({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [chainId, setChainId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Mainnet chain ID">
          <input
            value={chainId}
            onChange={(e) => setChainId(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className={cn(INPUT, "w-48")}
          />
        </Field>
        <Button
          variant="secondary"
          busy={busy}
          disabled={!chainId}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api(`/api/studio/projects/${projectId}/l1`, { method: "POST", json: { stage: "production", source: { kind: "catalog", chainId: Number(chainId) } } });
              onChanged();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Bind mainnet L1
        </Button>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}

/** The checklist's shape while the server checks the gates: the tests gate carries its export line, the L1 gate its field. */
function GatesSkeleton({ l1Form, count }: { l1Form: boolean; count: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Checking gates">
      <Board>
        <div className="flex min-h-9 items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <BoardBone className="h-2.5 w-14" />
          <BoardBone className="h-2.5 w-44" delay={0.04} />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={GATE_ROW}>
            <BoardBone className="mt-[3px] h-2.5 w-5" delay={i * 0.04} />
            <span className="flex w-4 shrink-0 justify-center pt-[5px]">
              <BoardBone className="h-2 w-2" delay={i * 0.04} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex h-5 items-center">
                <BoardBone className="h-3.5 w-40" delay={i * 0.04} />
              </span>
              <span className="flex h-5 items-center">
                <BoardBone className="h-2.5 w-72 max-w-full" delay={i * 0.04} />
              </span>
              {i === 2 && (
                <span className="mt-2 flex h-[22px] items-center gap-5">
                  <BoardBone className="h-3 w-44" delay={i * 0.04} />
                  <BoardBone className="h-3 w-48 max-sm:hidden" delay={i * 0.04} />
                </span>
              )}
              {i === 4 && l1Form && <BoardBone className="mt-2 h-[61px] w-80 max-w-full" delay={i * 0.04} />}
            </span>
          </div>
        ))}
      </Board>
      <Bone className="h-8 w-56" />
      <span className="flex h-5 items-center">
        <Bone className="h-3 w-80 max-w-full" delay={0.04} />
      </span>
    </div>
  );
}

export function ProductionPanel({
  overview,
  blueprints,
  onChanged,
  onPromoted,
  onOpenDeploy,
}: {
  overview: ProjectOverview;
  /** Names the production networks in the networks gate; without them it shows their keys. */
  blueprints?: BlueprintCard[];
  onChanged: () => void;
  onPromoted: (deploymentId: string) => void;
  /** Opens the Deploy tab, where a testnet deployment is finished first. */
  onOpenDeploy?: () => void;
}) {
  const { project } = overview;
  const candidates = overview.deployments.filter((d) => d.stage === "testnet" && d.status === "succeeded");
  const [sourceId, setSourceId] = useState(candidates[0]?.id ?? "");
  const [preview, setPreview] = useState<Preview | null>(() => PREVIEWS.get(candidates[0]?.id ?? "") ?? null);
  const [testsConfirmed, setTestsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checked = useRef<string | null>(sourceId);
  const names = useMemo(() => (blueprints ? networkNamesOf(blueprints) : null), [blueprints]);

  useEffect(() => {
    if (!sourceId && candidates[0]) setSourceId(candidates[0].id);
  }, [candidates, sourceId]);

  useEffect(() => {
    // Each check starts clean. A new source shows its last checklist, or none; a re-check keeps the one on screen.
    setError(null);
    if (checked.current !== sourceId) setPreview(PREVIEWS.get(sourceId) ?? null);
    checked.current = sourceId;
    if (!sourceId) return;
    let current = true;
    api<Preview>(`/api/studio/projects/${project.id}/deployments/${sourceId}/promotion`)
      .then((p) => {
        PREVIEWS.set(sourceId, p);
        if (current) setPreview(p);
      })
      .catch((e) => current && setError(errorText(e)));
    return () => {
      current = false;
    };
  }, [project.id, sourceId, overview.audit?.id, overview.project.runtime]);

  const gates = preview?.gates.map((g) => (g.id === "tests" ? { ...g, passed: testsConfirmed } : g)) ?? [];
  const passed = gates.filter((g) => g.passed).length;
  const left = gates.length - passed;
  const ready = gates.length > 0 && left === 0;
  const bound = project.runtime.production?.l1;
  const needsL1 = Object.values(project.networks).includes("l1");
  const source = candidates.find((d) => d.id === sourceId);
  // The first open gate is the one to work on, marked the way the runner marks its current step.
  const nextGate = gates.find((g) => !g.passed)?.id;

  const promote = async () => {
    setBusy(true);
    setError(null);
    try {
      const { deploymentId } = await api<{ deploymentId: string }>(`/api/studio/projects/${project.id}/deployments/${sourceId}/promotion`, {
        method: "POST",
        json: { testsConfirmed: true },
      });
      onChanged();
      onPromoted(deploymentId);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body?.gates)) setPreview((p) => (p ? { ...p, gates: e.body!.gates as Gate[] } : p));
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const detailOf = (g: Gate) => {
    if (g.id === "tests")
      return testsConfirmed ? (
        "You confirmed forge test passes on the export."
      ) : (
        <>
          Run <code className="font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">bash script/setup-deps.sh && forge test</code> on the export, then confirm.
        </>
      );
    if (g.id === "l1-binding")
      return g.passed && bound
        ? `${bound.name ?? "Your L1"}, chain ${bound.evmChainId}.`
        : "Enter its chain ID. The L1 must be in the Builder Hub L1 registry.";
    if (g.id === "networks" && g.passed && names && preview) {
      const roles = Object.entries(preview.networks);
      return roles.length === 1
        ? `Runs on ${names[roles[0][1]] ?? roles[0][1]}.`
        : roles.map(([role, key]) => `${role}: ${names[key] ?? key}`).join(" · ");
    }
    return g.detail;
  };

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <SectionHeader label="Migrate to production" />
        <EmptyState icon={ShieldCheck} title="Nothing to promote yet" action={onOpenDeploy && <Button onClick={onOpenDeploy}>Open Deploy</Button>}>
          Finish a testnet deployment with every check passing first.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeader label="Migrate to production" />
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Production runs the build that worked on testnet, on mainnet. Your wallet signs every step.
        </p>
        <HowItWorks>
          Each testnet network maps to its production counterpart. You confirm each transaction before your wallet signs it, and the server checks every gate again when
          you migrate.
        </HowItWorks>
      </section>

      <section className="flex flex-col gap-4">
        {candidates.length > 1 && (
          <Field label="Testnet deployment to promote">
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={cn(INPUT, "max-w-md")}>
              {candidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.blueprint_id} · {d.id.slice(0, 8)} · {timeAgo(d.created_at)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {preview ? (
          <Appear key={sourceId} className="flex flex-col gap-4">
            <Board>
              <BoardHeader
                label="Gates"
                action={
                  <span className={cn(MUTED, "truncate text-[11px]")}>
                    {candidates.length === 1 && source && (
                      <span title={`${source.blueprint_id}, succeeded on testnet ${timeAgo(source.created_at)}`}>
                        Promoting <span className="text-zinc-700 dark:text-zinc-300">{source.id.slice(0, 8)}</span> ·{" "}
                      </span>
                    )}
                    {passed} of {gates.length} pass
                  </span>
                }
              />
              {gates.map((g, i) => (
                <div
                  key={g.id}
                  aria-current={g.id === nextGate ? "step" : undefined}
                  className={cn(GATE_ROW, "relative", g.id === nextGate && "bg-zinc-50 dark:bg-zinc-900/60")}
                >
                  {g.id === nextGate && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-[#E6212F]" />}
                  <span className={cn("w-5 shrink-0 pt-[3px] font-mono text-[10px]", g.id === nextGate ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex w-4 shrink-0 justify-center pt-[3px]">
                    {g.passed ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : g.id === nextGate ? (
                      <span className="mt-[3px] h-2 w-2 bg-[#E6212F]" />
                    ) : (
                      <span className="mt-[3px] h-2 w-2 border border-zinc-300 dark:border-zinc-700" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13.5px] font-medium leading-5 text-zinc-900 dark:text-zinc-50">{g.title}</span>
                    <span className="break-words text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{detailOf(g)}</span>
                    {g.id === "tests" && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <a
                          href={`/api/studio/projects/${project.id}/export`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]", idInk)}
                        >
                          <Download className="h-3.5 w-3.5" /> Export Foundry project
                        </a>
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-800 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={testsConfirmed}
                            onChange={(e) => setTestsConfirmed(e.target.checked)}
                            className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100"
                          />
                          forge test passes on the export
                        </label>
                      </div>
                    )}
                    {g.id === "l1-binding" && !g.passed && <MainnetL1 projectId={project.id} onChanged={onChanged} />}
                  </div>
                </div>
              ))}
            </Board>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void promote()} busy={busy} disabled={!ready}>
                Migrate to production
              </Button>
              {!ready && (
                <span className={cn(MUTED, "text-[11px]")}>
                  {left} {left === 1 ? "gate" : "gates"} left
                </span>
              )}
            </div>

            <p className="text-[12.5px] leading-5 text-zinc-500 dark:text-zinc-400">
              For contracts that will hold real value,{" "}
              <Link href="/audits/new" className={idInk}>
                request a professional audit
              </Link>{" "}
              first.
            </p>
          </Appear>
        ) : (
          sourceId && !error && <GatesSkeleton count={needsL1 ? 5 : 4} l1Form={needsL1 && !bound} />
        )}
        {error && <Notice tone="bad">{error}</Notice>}
      </section>
    </div>
  );
}
