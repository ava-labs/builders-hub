"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Download } from "lucide-react";
import { Board, BoardHeader, EmptyRow, MUTED, SectionHeader, idInk } from "@/components/explorer-v2/ui";
import { cn } from "@/lib/utils";
import { ApiError, api, errorText, type Gate, type ProjectOverview } from "./api";
import { Button, Field, INPUT, LABEL, Notice } from "./ui";

interface Preview {
  gates: Gate[];
  networks: Record<string, string>;
  unsupported: { role: string; network: string; reason: string }[];
}

function MainnetL1({ projectId, overview, onChanged }: { projectId: string; overview: ProjectOverview; onChanged: () => void }) {
  const bound = overview.project.runtime.production?.l1;
  const [chainId, setChainId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
      <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
        {bound ? `Production L1: ${bound.name} (chain ${bound.evmChainId}).` : "Bind the mainnet L1 this project should run on. It must be in the Builder Hub L1 registry."}
      </span>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Mainnet chain ID">
          <input value={chainId} onChange={(e) => setChainId(e.target.value.replace(/\D/g, ""))} className={cn(INPUT, "w-48")} />
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

export function ProductionPanel({
  overview,
  onChanged,
  onPromoted,
}: {
  overview: ProjectOverview;
  onChanged: () => void;
  onPromoted: (deploymentId: string) => void;
}) {
  const { project } = overview;
  const candidates = overview.deployments.filter((d) => d.stage === "testnet" && d.status === "succeeded");
  const [sourceId, setSourceId] = useState(candidates[0]?.id ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testsConfirmed, setTestsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId && candidates[0]) setSourceId(candidates[0].id);
  }, [candidates, sourceId]);

  useEffect(() => {
    setPreview(null);
    if (!sourceId) return;
    api<Preview>(`/api/studio/projects/${project.id}/deployments/${sourceId}/promotion`)
      .then(setPreview)
      .catch((e) => setError(errorText(e)));
  }, [project.id, sourceId, overview.audit?.id, overview.project.runtime]);

  const gates = preview?.gates.map((g) => (g.id === "tests" ? { ...g, passed: testsConfirmed } : g)) ?? [];
  const ready = gates.length > 0 && gates.every((g) => g.passed);
  const needsL1 = preview?.gates.some((g) => g.id === "l1-binding");

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

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader label="Migrate to production" />
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Production runs the exact build that worked on testnet, on the production counterpart of each network, signed step by step by
          your wallet with a confirmation before every transaction. The server checks every gate again when you migrate.
        </p>
        {candidates.length === 0 ? (
          <Notice>Finish a testnet deployment with every check passing first.</Notice>
        ) : (
          <Field label="Testnet deployment to promote">
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={cn(INPUT, "max-w-md")}>
              {candidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.blueprint_id} · {d.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>

      {preview && (
        <>
          <Board>
            <BoardHeader label="Gates" />
            {gates.map((g) => (
              <div key={g.id} className="flex items-start gap-3 px-5 py-3 md:px-6">
                {g.passed ? <Check className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <CircleAlert className="mt-0.5 h-4 w-4 text-zinc-400" />}
                <span className="min-w-0">
                  <span className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">{g.title}</span>
                  <span className="block text-[12.5px] text-zinc-500 dark:text-zinc-400">
                    {g.id === "tests" ? (testsConfirmed ? "You confirmed forge test passes on the export." : g.detail) : g.detail}
                  </span>
                </span>
              </div>
            ))}
          </Board>

          <Board>
            <BoardHeader label="Tests" />
            <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
              <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Download the project as a Foundry project, run <code className="font-mono text-[12px]">bash script/setup-deps.sh && forge test</code>, and confirm
                it passes.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={`/api/studio/projects/${project.id}/export`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]", idInk)}
                >
                  <Download className="h-3.5 w-3.5" /> Export Foundry project
                </a>
                <label className="flex items-center gap-2 text-[13px] text-zinc-800 dark:text-zinc-200">
                  <input type="checkbox" checked={testsConfirmed} onChange={(e) => setTestsConfirmed(e.target.checked)} className="h-4 w-4 accent-zinc-900" />
                  forge test passes on the export
                </label>
              </div>
            </div>
          </Board>

          {needsL1 && (
            <Board>
              <BoardHeader label="Mainnet L1" />
              <MainnetL1 projectId={project.id} overview={overview} onChanged={onChanged} />
            </Board>
          )}

          <Board>
            <BoardHeader label="Before real value is at stake" />
            <div className="px-5 py-4 text-[13px] leading-relaxed text-zinc-600 md:px-6 dark:text-zinc-400">
              Studio&apos;s audit is static analysis plus a checklist. For contracts that will hold meaningful value,{" "}
              <Link href="/audits/new" className={idInk}>
                request a professional audit
              </Link>{" "}
              through Builder Hub: vetted firms quote on your project.
            </div>
          </Board>

          {Object.keys(preview.networks).length > 0 && (
            <p className={cn(MUTED, "text-[11px]")}>
              <span className={LABEL}>Networks </span>
              {Object.entries(preview.networks)
                .map(([role, network]) => `${role} → ${network}`)
                .join(" · ")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => void promote()} busy={busy} disabled={!ready}>
              Migrate to production
            </Button>
            {!ready && <span className={cn(MUTED, "text-[11px]")}>Every gate has to pass.</span>}
          </div>
        </>
      )}
      {!preview && sourceId && !error && <EmptyRow>Checking gates…</EmptyRow>}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
