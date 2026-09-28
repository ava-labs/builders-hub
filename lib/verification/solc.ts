import "server-only";
import { fork, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { keccak256 } from "viem";

/* ------------------------------------------------------------------ */
/* Solidity compilation.                                               */
/*                                                                     */
/* compileStandardJson() is the only place that knows how compilation  */
/* happens. Everything upstream — jobs, APIs, matching, UI — takes a   */
/* CompileResult and is indifferent to whether solc ran in this        */
/* process, in a child process, or behind an HTTP call to a verifier   */
/* service. Keep it that way: moving compilation off Vercel should     */
/* touch this file and nothing else.                                   */
/*                                                                     */
/* The compiler itself is solc-js: a self-contained JS/wasm build      */
/* fetched from binaries.soliditylang.org, so there is no native       */
/* binary to install and no container to run. It is single-threaded    */
/* and CPU-bound, which is why it runs in a child process: this        */
/* instance stays responsive, and a runaway compile can be killed.     */
/* ------------------------------------------------------------------ */

const BINARIES_BASE = "https://binaries.soliditylang.org/wasm";

/** Hard ceiling on a single compile. This — not the route's maxDuration —
 *  is what bounds the cost of one hostile submission. */
export const COMPILE_TIMEOUT_MS = 180_000;

/** Standard JSON input larger than this is rejected before we look at it. */
export const MAX_INPUT_BYTES = 6 * 1024 * 1024;

/** /tmp is 512 MB and each compiler build is 10-25 MB. */
const MAX_CACHED_COMPILERS = 15;

/** An attacker naming a hundred different compiler versions would otherwise
 *  make us download a hundred compilers. Legitimate traffic touches a
 *  handful of versions. */
const DOWNLOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_DOWNLOADS_PER_WINDOW = 20;

const CACHE_DIR = path.join(os.tmpdir(), "solc-cache");

export interface SolcBuild {
  path: string;
  version: string;
  longVersion: string;
  keccak256?: string;
}

export interface CompileResult {
  output: SolcOutput;
  /** The resolved long version, e.g. "0.8.24+commit.e11b9ed9". */
  longVersion: string;
}

export interface SolcOutput {
  errors?: SolcError[];
  contracts?: Record<string, Record<string, SolcContract>>;
  sources?: Record<string, { id: number }>;
}

export interface SolcError {
  severity: "error" | "warning" | "info";
  type?: string;
  message: string;
  formattedMessage?: string;
}

export interface SolcContract {
  abi?: unknown[];
  metadata?: string;
  evm?: {
    bytecode?: { object?: string; linkReferences?: LinkReferences };
    deployedBytecode?: {
      object?: string;
      linkReferences?: LinkReferences;
      immutableReferences?: Record<string, { start: number; length: number }[]>;
    };
  };
}

export type LinkReferences = Record<string, Record<string, { start: number; length: number }[]>>;

export class CompileError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unknown_compiler_version"
      | "compiler_unavailable"
      | "compilation_timeout"
      | "compiler_crashed"
      | "input_too_large",
  ) {
    super(message);
    this.name = "CompileError";
  }
}

/* ---------------------------- version list --------------------------- */

const LIST_TTL_MS = 24 * 60 * 60 * 1000;
let buildList: { at: number; builds: SolcBuild[]; releases: Record<string, string> } | null = null;
let listInFlight: Promise<void> | null = null;

async function loadBuildList(): Promise<void> {
  if (buildList && Date.now() - buildList.at < LIST_TTL_MS) return;
  if (listInFlight) return listInFlight;

  listInFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${BINARIES_BASE}/list.json`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { builds: SolcBuild[]; releases: Record<string, string> };
      buildList = { at: Date.now(), builds: body.builds ?? [], releases: body.releases ?? {} };
    } catch (error) {
      // A stale list still resolves every version anyone has used before,
      // so an unreachable upstream only matters on a cold instance.
      if (!buildList) {
        throw new CompileError(`Could not load the compiler list: ${error}`, "compiler_unavailable");
      }
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    listInFlight = null;
  });

  return listInFlight;
}

/** Released versions, newest first — for the compiler picker in the UI. */
export async function listReleases(): Promise<{ version: string; longVersion: string }[]> {
  await loadBuildList();
  const releases = buildList?.releases ?? {};
  const byPath = new Map((buildList?.builds ?? []).map((b) => [b.path, b]));
  return Object.entries(releases)
    .map(([version, file]) => ({ version, longVersion: byPath.get(file)?.longVersion ?? version }))
    .sort((a, b) => compareVersions(b.version, a.version));
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Resolve what the caller wrote to a build in the official list. Accepts
 * "v0.8.24+commit.e11b9ed9", "0.8.24+commit.e11b9ed9", or a bare "0.8.24"
 * (which resolves to that release's canonical build).
 *
 * Only versions in the list are ever fetched — the version string is
 * caller-controlled and must never become a URL path.
 */
export async function resolveCompilerVersion(requested: string): Promise<SolcBuild> {
  await loadBuildList();
  const list = buildList;
  if (!list) throw new CompileError("Compiler list unavailable", "compiler_unavailable");

  const normalized = requested.trim().replace(/^v/, "");
  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.+-]+)?$/.test(normalized)) {
    throw new CompileError(`Not a Solidity version: ${requested}`, "unknown_compiler_version");
  }

  const exact = list.builds.find((b) => b.longVersion === normalized);
  if (exact) return exact;

  const releaseFile = list.releases[normalized];
  if (releaseFile) {
    const build = list.builds.find((b) => b.path === releaseFile);
    if (build) return build;
  }

  throw new CompileError(
    `Unknown compiler version "${requested}". Use a version from https://binaries.soliditylang.org/wasm/list.json.`,
    "unknown_compiler_version",
  );
}

/* ------------------------------ downloads ---------------------------- */

const downloadTimestamps: number[] = [];
const downloadsInFlight = new Map<string, Promise<string>>();

function reserveDownloadSlot(): boolean {
  const now = Date.now();
  while (downloadTimestamps.length && now - downloadTimestamps[0] > DOWNLOAD_WINDOW_MS) {
    downloadTimestamps.shift();
  }
  if (downloadTimestamps.length >= MAX_DOWNLOADS_PER_WINDOW) return false;
  downloadTimestamps.push(now);
  return true;
}

async function evictOldCompilers(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR);
    const compilers = files.filter((f) => f.endsWith(".js"));
    if (compilers.length <= MAX_CACHED_COMPILERS) return;

    const stats = await Promise.all(
      compilers.map(async (file) => {
        const full = path.join(CACHE_DIR, file);
        try {
          return { full, at: (await fs.stat(full)).atimeMs };
        } catch {
          return { full, at: 0 };
        }
      }),
    );
    stats.sort((a, b) => a.at - b.at);
    for (const victim of stats.slice(0, stats.length - MAX_CACHED_COMPILERS)) {
      await fs.rm(victim.full, { force: true });
    }
  } catch {
    /* eviction is best-effort; a full /tmp surfaces as a download failure */
  }
}

/** Absolute path to a cached compiler build, downloading it if needed. */
async function compilerPath(build: SolcBuild): Promise<string> {
  const target = path.join(CACHE_DIR, `${build.longVersion}.js`);

  try {
    await fs.access(target);
    // Touch so the LRU keeps versions that are actually being used.
    const now = new Date();
    await fs.utimes(target, now, now).catch(() => {});
    return target;
  } catch {
    /* not cached yet */
  }

  const existing = downloadsInFlight.get(build.longVersion);
  if (existing) return existing;

  const download = (async () => {
    if (!reserveDownloadSlot()) {
      throw new CompileError(
        "Too many different compiler versions requested recently. Try again in a few minutes.",
        "compiler_unavailable",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let source: Buffer;
    try {
      const res = await fetch(`${BINARIES_BASE}/${build.path}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      source = Buffer.from(await res.arrayBuffer());
    } catch (error) {
      throw new CompileError(`Could not download solc ${build.longVersion}: ${error}`, "compiler_unavailable");
    } finally {
      clearTimeout(timer);
    }

    if (build.keccak256) {
      const digest = keccak256(new Uint8Array(source));
      if (digest.toLowerCase() !== build.keccak256.toLowerCase()) {
        throw new CompileError(
          `Checksum mismatch for solc ${build.longVersion} — refusing to run it.`,
          "compiler_unavailable",
        );
      }
    }

    await fs.mkdir(CACHE_DIR, { recursive: true });
    // Write then rename so a torn download can never be executed.
    const staging = path.join(CACHE_DIR, `.${process.pid}-${Date.now()}.tmp`);
    await fs.writeFile(staging, source);
    await fs.rename(staging, target);
    await evictOldCompilers();
    return target;
  })().finally(() => {
    downloadsInFlight.delete(build.longVersion);
  });

  downloadsInFlight.set(build.longVersion, download);
  return download;
}

/* --------------------------- compiler process ------------------------ */

/*
 * Runs in its own process as plain CommonJS, talking to the parent over
 * IPC. It deliberately requires nothing but Node builtins: the file is
 * written to /tmp, so it sits outside the deployment's module tree and
 * could not resolve a package even if it wanted to.
 *
 * A separate process rather than a worker thread, for two reasons. It can
 * be killed outright when it overruns, and its heap is its own — a
 * compile that runs away takes nothing else down with it. It also keeps
 * the bundler out of our business: `new Worker(path)` is read as a static
 * worker entry point and the build tries to resolve a path that only
 * exists at runtime, which it answers by dragging arbitrary assets into
 * the module graph.
 *
 * The wrapper is small because we only ever compile Standard JSON, whose
 * sources are inlined — there is no import callback to service, which is
 * the complicated half of solc-js's own wrapper.
 */
const RUNNER_SOURCE = `
"use strict";
const fs = require("node:fs");

function loadCompiler(file) {
  const code = fs.readFileSync(file, "utf8");
  const shim = { exports: {} };
  // Emscripten builds detect CommonJS and assign to module.exports.
  new Function("module", "exports", "require", "__dirname", "__filename", code)(
    shim,
    shim.exports,
    require,
    "/",
    file,
  );
  return shim.exports;
}

async function instantiate(loaded) {
  let mod = loaded;
  // Newer builds are MODULARIZE'd: the export is a factory.
  if (typeof mod === "function") mod = mod();
  if (mod && typeof mod.then === "function") mod = await mod;
  if (mod && typeof mod.cwrap !== "function" && mod.ready && typeof mod.ready.then === "function") {
    mod = await mod.ready;
  }
  if (mod && typeof mod.cwrap !== "function") {
    // Asynchronous wasm instantiation: wait for the runtime callback.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("compiler runtime did not initialise")), 60000);
      const previous = mod.onRuntimeInitialized;
      mod.onRuntimeInitialized = () => {
        clearTimeout(timer);
        if (typeof previous === "function") previous();
        resolve();
      };
    });
  }
  if (!mod || typeof mod.cwrap !== "function") throw new Error("unrecognised compiler build");
  return mod;
}

function compile(mod, inputJson) {
  // 0.5.0 and later expose solidity_compile; the callback argument gained a
  // context parameter in 0.6.x. Extra arguments to a wasm export are ignored,
  // so the wider signature is safe for both.
  if (typeof mod._solidity_compile === "function") {
    return mod.cwrap("solidity_compile", "string", ["string", "number", "number"])(inputJson, 0, 0);
  }
  // 0.4.11 through 0.4.26.
  if (typeof mod._compileStandard === "function") {
    return mod.cwrap("compileStandard", "string", ["string", "number"])(inputJson, 0);
  }
  throw new Error("this compiler build cannot accept Standard JSON input");
}

function reply(payload) {
  // Exit only once the parent has the answer; a bare process.exit() can
  // truncate an IPC write that is still in flight.
  process.send(payload, () => process.exit(0));
}

process.on("message", async (job) => {
  try {
    const mod = await instantiate(loadCompiler(job.compilerPath));
    reply({ ok: true, output: compile(mod, job.input) });
  } catch (error) {
    reply({ ok: false, error: error && error.message ? error.message : String(error) });
  }
});
`;

let runnerPathPromise: Promise<string> | null = null;

function runnerFile(): Promise<string> {
  if (runnerPathPromise) return runnerPathPromise;
  runnerPathPromise = (async () => {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const digest = createHash("sha256").update(RUNNER_SOURCE).digest("hex").slice(0, 12);
    const file = path.join(CACHE_DIR, `compile-runner-${digest}.cjs`);
    await fs.writeFile(file, RUNNER_SOURCE);
    return file;
  })().catch((error) => {
    runnerPathPromise = null;
    throw new CompileError(`Could not stage the compiler runner: ${error}`, "compiler_unavailable");
  });
  return runnerPathPromise;
}

async function runCompiler(compilerPathOnDisk: string, input: string): Promise<string> {
  const file = await runnerFile();

  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = fork(file, [], {
        // Big contracts need headroom, but not unbounded headroom, and
        // the cap belongs to the child rather than to this function.
        execArgv: ["--max-old-space-size=3072"],
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
    } catch (error) {
      reject(new CompileError(`Could not start the compiler: ${error}`, "compiler_unavailable"));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // SIGKILL: a process wedged inside wasm will not honour anything
      // politer, and this path exists precisely for the wedged case.
      if (child.connected) child.disconnect();
      child.kill("SIGKILL");
      fn();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new CompileError(
            `Compilation exceeded the ${COMPILE_TIMEOUT_MS / 1000}s limit. Contracts this large need a dedicated verifier.`,
            "compilation_timeout",
          ),
        ),
      );
    }, COMPILE_TIMEOUT_MS);

    child.on("message", (message: { ok: boolean; output?: string; error?: string }) => {
      finish(() =>
        message.ok && message.output
          ? resolve(message.output)
          : reject(new CompileError(message.error ?? "compiler failed", "compiler_crashed")),
      );
    });
    child.on("error", (error) => {
      finish(() => reject(new CompileError(`Compiler crashed: ${error.message}`, "compiler_crashed")));
    });
    child.on("exit", (code, signal) => {
      // Exiting after an answer is normal and already settled. Reaching
      // here unsettled means it died without one — out of memory, most
      // likely, since that is what the heap cap is there to catch.
      finish(() =>
        reject(
          new CompileError(
            code === 0
              ? "Compiler exited without producing output"
              : `Compiler ran out of resources (exit ${code ?? signal})`,
            "compiler_crashed",
          ),
        ),
      );
    });

    child.send({ compilerPath: compilerPathOnDisk, input }, (error) => {
      if (error) {
        finish(() =>
          reject(new CompileError(`Could not hand the job to the compiler: ${error.message}`, "compiler_crashed")),
        );
      }
    });
  });
}

/* ------------------------------ public API --------------------------- */

/**
 * Compile with a soljson build that is already on disk, bypassing version
 * resolution and download. The seam between "get a compiler" and "run a
 * compiler" — useful for testing the loader against a known build, and
 * the hook a pre-bundled compiler would use.
 */
export async function compileWithCompilerAt(
  compilerPathOnDisk: string,
  stdJsonInput: unknown,
): Promise<SolcOutput> {
  const raw = await runCompiler(compilerPathOnDisk, JSON.stringify(stdJsonInput));
  try {
    return JSON.parse(raw) as SolcOutput;
  } catch {
    throw new CompileError("Compiler returned output we could not parse", "compiler_crashed");
  }
}

/**
 * Compile a Standard JSON input with the requested compiler.
 *
 * Throws CompileError for anything that prevented compilation from
 * running (unknown version, download failure, timeout, crash). A
 * compilation that ran and produced errors is a successful call whose
 * `output.errors` carries them — that distinction matters upstream,
 * because the first is our problem and the second is the submitter's.
 */
export async function compileStandardJson({
  stdJsonInput,
  compilerVersion,
}: {
  stdJsonInput: unknown;
  compilerVersion: string;
}): Promise<CompileResult> {
  const input = JSON.stringify(stdJsonInput);
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
    throw new CompileError(
      `Standard JSON input exceeds the ${Math.round(MAX_INPUT_BYTES / 1024 / 1024)} MB limit.`,
      "input_too_large",
    );
  }

  const build = await resolveCompilerVersion(compilerVersion);
  const compiler = await compilerPath(build);
  const raw = await runCompiler(compiler, input);

  let output: SolcOutput;
  try {
    output = JSON.parse(raw) as SolcOutput;
  } catch {
    throw new CompileError("Compiler returned output we could not parse", "compiler_crashed");
  }

  return { output, longVersion: build.longVersion };
}

/** Errors that stopped compilation, ignoring warnings and info notes. */
export function fatalErrors(output: SolcOutput): SolcError[] {
  return (output.errors ?? []).filter((error) => error.severity === "error");
}

/**
 * Reduce an input to the three keys solc actually defines.
 *
 * The compiler rejects a Standard JSON input outright if it carries keys it
 * doesn't know, and build tools routinely add their own. Foundry's
 * build-info writes `allowPaths`, `basePath`, `includePaths` and `version`
 * beside the real ones, which earns an `Unknown key "allowPaths"` before
 * solc looks at a single line of Solidity.
 *
 * Dropping them cannot change the bytecode: they all concern resolving
 * imports from disk, which never applies here because Standard JSON
 * carries its sources inline. Anything that did affect codegen would have
 * to live under `settings`, which is passed through untouched.
 */
export function toCompilerInput<T extends { language?: string; sources?: unknown; settings?: unknown }>(
  input: T,
): T {
  return {
    language: input.language ?? "Solidity",
    sources: input.sources,
    ...(input.settings ? { settings: input.settings } : {}),
  } as T;
}
