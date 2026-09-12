"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, FileJson, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { Board, CellLabel, SectionHeader, SpecPlate, SpecRow } from "@/components/explorer-v2/ui";
import { fetchVerifiedContract, forgetVerifiedContract } from "@/lib/sourcify-client";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";

/* ------------------------------------------------------------------ */
/* The verify form.                                                    */
/*                                                                     */
/* Standard JSON is the only accepted input, which sounds strict until */
/* you notice that both Hardhat and Foundry already write it to disk:  */
/* artifacts/build-info/*.json for one, out/*.json for the other. So   */
/* the form asks for a file people already have rather than making     */
/* them flatten sources by hand.                                       */
/*                                                                     */
/* It posts to the same Sourcify-compatible endpoint the CLI tools use */
/* — no private form-only API to drift out of sync with the real one.  */
/* ------------------------------------------------------------------ */

interface StandardJson {
  language?: string;
  sources?: Record<string, { content?: string }>;
  settings?: Record<string, unknown>;
}

interface BuildInfo {
  solcLongVersion?: string;
  solcVersion?: string;
  input?: StandardJson;
  output?: { contracts?: Record<string, Record<string, unknown>> };
}

interface ParsedInput {
  stdJsonInput: StandardJson;
  /** Fully qualified `file:Contract` candidates found in the input. */
  candidates: string[];
  /** Present when the file was a Hardhat build-info, which names its compiler. */
  compilerVersion: string | null;
  fileName: string;
}

/** Declarations in a Solidity source, so a plain Standard JSON (which
 *  doesn't list contract names anywhere) can still populate the picker.
 *  A build-info file gives us the real thing and skips this. */
function declarationsIn(content: string): string[] {
  const names: string[] = [];
  const pattern = /^\s*(?:abstract\s+)?contract\s+([A-Za-z_$][\w$]*)/gm;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    names.push(match[1]);
  }
  return names;
}

function parseUpload(text: string, fileName: string): ParsedInput | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }

  const maybeBuildInfo = parsed as BuildInfo;
  const isBuildInfo = Boolean(maybeBuildInfo.input?.sources && maybeBuildInfo.solcLongVersion);

  const stdJsonInput = (isBuildInfo ? maybeBuildInfo.input : parsed) as StandardJson;
  if (!stdJsonInput?.sources || Object.keys(stdJsonInput.sources).length === 0) {
    return {
      error:
        "No sources found. Upload a Standard JSON input, or a Hardhat build-info file from artifacts/build-info/.",
    };
  }
  if (stdJsonInput.language && stdJsonInput.language !== "Solidity") {
    return { error: `Only Solidity is supported; this input declares ${stdJsonInput.language}.` };
  }

  const candidates: string[] = [];
  if (isBuildInfo && maybeBuildInfo.output?.contracts) {
    for (const [file, contracts] of Object.entries(maybeBuildInfo.output.contracts)) {
      for (const name of Object.keys(contracts)) candidates.push(`${file}:${name}`);
    }
  } else {
    for (const [file, source] of Object.entries(stdJsonInput.sources)) {
      for (const name of declarationsIn(source.content ?? "")) candidates.push(`${file}:${name}`);
    }
  }

  return {
    stdJsonInput,
    candidates: candidates.sort(),
    compilerVersion: isBuildInfo ? (maybeBuildInfo.solcLongVersion ?? null) : null,
    fileName,
  };
}

type Phase =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "polling"; verificationId: string }
  | { state: "verified" }
  | { state: "failed"; message: string };

const POLL_INTERVAL_MS = 3_000;

export function EvmVerify({ network, addr }: { network: string; addr: string }) {
  const c = useChainContext();
  const router = useRouter();
  const base = `/explorer/${network}/${c.chainSlug}`;

  const [input, setInput] = useState<ParsedInput | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [compilerVersion, setCompilerVersion] = useState("");
  const [releases, setReleases] = useState<{ version: string; longVersion: string }[]>([]);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [dragging, setDragging] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/verify/compilers")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { releases?: { version: string; longVersion: string }[] } | null) => {
        setReleases(body?.releases ?? []);
      })
      .catch(() => {});
  }, []);

  /* A verified contract cannot be verified again — the API rejects it —
     so offering the form would only waste an upload and return an error
     the submitter can do nothing about. Checked with caches bypassed,
     because this is exactly where a stale "unverified" would mislead. */
  useEffect(() => {
    let cancelled = false;
    fetchVerifiedContract(c.chainId, addr, { force: true })
      .then((found) => {
        if (!cancelled) setAlreadyVerified(Boolean(found));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [c.chainId, addr]);

  const accept = useCallback((file: File) => {
    setParseError(null);
    void file.text().then((text) => {
      const result = parseUpload(text, file.name);
      if ("error" in result) {
        setParseError(result.error);
        setInput(null);
        return;
      }
      setInput(result);
      setIdentifier(result.candidates[0] ?? "");
      if (result.compilerVersion) setCompilerVersion(result.compilerVersion);
      setPhase({ state: "idle" });
    });
  }, []);

  /* Poll the same job endpoint the CLI tools poll. */
  useEffect(() => {
    if (phase.state !== "polling") return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/verify/sourcify/v2/verify/${phase.verificationId}`);
        if (!res.ok) throw new Error("lost");
        const body = (await res.json()) as {
          isJobCompleted: boolean;
          contract?: { match: string | null };
          error?: { message: string };
        };
        if (cancelled) return;
        if (!body.isJobCompleted) return;

        if (body.contract?.match) {
          // Prime the session cache with the verified record before leaving,
          // so the Contract tab paints verified on its first frame. Landing
          // there and re-asking would race a browser-cached "unverified"
          // from before this page was opened.
          forgetVerifiedContract(c.chainId, addr);
          void fetchVerifiedContract(c.chainId, addr, { force: true });
          setPhase({ state: "verified" });
          setTimeout(
            () => router.push(`${base}/address/${addr}?tab=contract&verified=1`),
            1200,
          );
        } else {
          setPhase({ state: "failed", message: body.error?.message ?? "Verification failed." });
        }
      } catch {
        if (!cancelled) {
          setPhase({ state: "failed", message: "Lost contact with the verifier. Try submitting again." });
        }
      }
    };

    void tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, c.chainId, addr, base, router]);

  const submit = useCallback(async () => {
    if (!input || !identifier || !compilerVersion) return;
    setPhase({ state: "submitting" });

    try {
      const res = await fetch(`/api/verify/sourcify/v2/verify/${c.chainId}/${addr.toLowerCase()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stdJsonInput: input.stdJsonInput,
          compilerVersion,
          contractIdentifier: identifier,
        }),
      });
      const body = (await res.json()) as { verificationId?: string; message?: string };

      if (!res.ok || !body.verificationId) {
        setPhase({ state: "failed", message: body.message ?? "The verifier rejected this submission." });
        return;
      }
      setPhase({ state: "polling", verificationId: body.verificationId });
    } catch {
      setPhase({ state: "failed", message: "Could not reach the verifier." });
    }
  }, [input, identifier, compilerVersion, c.chainId, addr]);

  const busy = phase.state === "submitting" || phase.state === "polling";
  const canSubmit = Boolean(input && identifier && compilerVersion) && !busy;

  const sourceCount = useMemo(
    () => (input ? Object.keys(input.stdJsonInput.sources ?? {}).length : 0),
    [input],
  );

  return (
    <EvmShell network={network}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <SectionHeader label="Verify contract" />
          <Board divide={false} className="px-5 py-4 md:px-6">
            <SpecPlate>
              <SpecRow label="Address">
                <span className="break-all font-mono text-[12px]">{addr}</span>
              </SpecRow>
              <SpecRow label="Chain">
                {c.chainName} · {c.chainId}
              </SpecRow>
            </SpecPlate>
          </Board>
        </section>

        {alreadyVerified ? (
          <Board divide={false} className="px-6 py-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#3f7d43] dark:text-[#77c47b]">
              Already verified
            </p>
            <p className="mx-auto mt-4 max-w-lg text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              This contract&apos;s source is already published. Verifying it again would be
              rejected, since the bytecode has already been matched.
            </p>
            <Link
              href={`${base}/address/${addr}?tab=contract`}
              className="mt-6 inline-flex items-center gap-2 border border-zinc-900 bg-zinc-900 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Check className="size-3.5" />
              View contract
            </Link>
          </Board>
        ) : (
        <>
        <section className="flex flex-col gap-4">
          <SectionHeader label="Compiler input" />

          <Board divide={false}>
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) accept(file);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-12 text-center transition-colors",
                dragging
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600",
              )}
            >
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) accept(file);
                }}
              />
              {input ? (
                <>
                  <FileJson className="size-5 text-zinc-400" />
                  <p className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{input.fileName}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {sourceCount} source {sourceCount === 1 ? "file" : "files"}
                    {input.compilerVersion ? ` · solc ${input.compilerVersion}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="size-5 text-zinc-400" />
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
                    Drop a build-info file or a Standard JSON input
                  </p>
                  <p className="max-w-md font-mono text-[10px] leading-relaxed tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
                    hardhat: artifacts/build-info/*.json · foundry: out/build-info/*.json after
                    `forge build --build-info`
                  </p>
                </>
              )}
            </label>
          </Board>

          {parseError ? (
            <div className="flex items-start gap-2 border border-[#C7911B]/40 px-4 py-3 text-[12px] text-[#9c7112] dark:text-[#e2b953]">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {parseError}
            </div>
          ) : null}
        </section>

        {input ? (
          <section className="flex flex-col gap-4">
            <SectionHeader label="Contract" />
            <Board divide={false} className="flex flex-col gap-5 px-5 py-5 md:px-6">
              <div className="flex flex-col gap-2">
                <CellLabel>Contract to verify</CellLabel>
                {input.candidates.length ? (
                  <select
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="w-full border border-zinc-200 bg-white px-3 py-2 font-mono text-[12px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {input.candidates.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="contracts/Token.sol:Token"
                    className="w-full border border-zinc-200 bg-white px-3 py-2 font-mono text-[12px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <CellLabel>Compiler version</CellLabel>
                {input.compilerVersion ? (
                  <p className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                    {input.compilerVersion}
                    <span className="ml-2 text-zinc-400 dark:text-zinc-500">from build-info</span>
                  </p>
                ) : (
                  <select
                    value={compilerVersion}
                    onChange={(event) => setCompilerVersion(event.target.value)}
                    className="w-full border border-zinc-200 bg-white px-3 py-2 font-mono text-[12px] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value="">Select a version…</option>
                    {releases.map((release) => (
                      <option key={release.longVersion} value={release.longVersion}>
                        {release.longVersion}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className={cn(
                    "inline-flex items-center gap-2 border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-opacity",
                    canSubmit
                      ? "border-zinc-900 bg-zinc-900 text-white hover:opacity-90 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "cursor-not-allowed border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600",
                  )}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {phase.state === "polling" ? "Compiling…" : "Verify"}
                </button>

                {phase.state === "verified" ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#3f7d43] dark:text-[#77c47b]">
                    <Check className="size-3.5" />
                    Verified — taking you to the contract
                  </span>
                ) : null}
              </div>

              {phase.state === "failed" ? (
                <div className="flex items-start gap-2 border border-[#C7911B]/40 px-4 py-3 text-[12px] leading-relaxed text-[#9c7112] dark:text-[#e2b953]">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono text-[11px]">{phase.message}</pre>
                </div>
              ) : null}
            </Board>
          </section>
        ) : null}
        </>
        )}

        <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Prefer the command line? This page posts to the same API that `hardhat verify` and
          `forge verify-contract` use.{" "}
          <Link href="/docs/tooling/contract-verification" className="underline underline-offset-2">
            See the setup for your tool
          </Link>
          .
        </p>
      </div>
    </EvmShell>
  );
}
