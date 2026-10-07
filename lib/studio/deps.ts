import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { loadCompilerDefaults } from "@/lib/blueprints";
import { isSafeUnitPath, type SourceReader } from "./sources";
import { untar } from "./tar";

/*
 * Solidity dependency sources at the versions pinned in
 * blueprints/_shared/compiler.json. A checkout that ran
 * scripts/blueprints/setup-test-deps.sh reads .blueprint-deps; a server
 * fetches each npm tarball once per instance, checks it against the pinned
 * sha256, and unpacks only the .sol files into /tmp.
 */

const REGISTRY = "https://registry.npmjs.org";
const CACHE_DIR = path.join(os.tmpdir(), "studio-deps");
const DOWNLOAD_TIMEOUT_MS = 60_000;

interface Dependency {
  name: string;
  version: string;
  sha256: string;
}

function pinnedDependencies(): Dependency[] {
  const compiler = loadCompilerDefaults();
  return Object.entries(compiler.dependencies).map(([name, version]) => {
    const sha256 = compiler.integrity[name];
    if (!sha256) throw new Error(`compiler.json has no integrity hash for ${name}`);
    return { name, version, sha256 };
  });
}

async function versionAt(dir: string): Promise<string | undefined> {
  return fs
    .readFile(path.join(dir, ".version"), "utf8")
    .then((v) => v.trim())
    .catch(() => undefined);
}

async function download(dep: Dependency, target: string): Promise<string> {
  const url = `${REGISTRY}/${dep.name}/-/${dep.name.split("/").pop()}-${dep.version}.tgz`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let tarball: Buffer;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tarball = Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }

  const digest = createHash("sha256").update(tarball).digest("hex");
  if (digest !== dep.sha256) {
    throw new Error(`Checksum mismatch for ${dep.name}@${dep.version}: refusing to use it`);
  }

  const staging = `${target}.${process.pid}-${Date.now()}.tmp`;
  for (const entry of untar(gunzipSync(tarball))) {
    const rel = entry.path.replace(/^package\//, "");
    if (!rel.endsWith(".sol") || !isSafeUnitPath(rel)) continue;
    const file = path.join(staging, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, entry.data);
  }
  await fs.writeFile(path.join(staging, ".version"), dep.version);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(staging, target).catch(async (error) => {
    // Another request unpacked it first.
    await fs.rm(staging, { recursive: true, force: true });
    if ((await versionAt(target)) !== dep.version) throw error;
  });
  return target;
}

const roots = new Map<string, Promise<string>>();

function packageRoot(dep: Dependency): Promise<string> {
  const key = `${dep.name}@${dep.version}`;
  let root = roots.get(key);
  if (!root) {
    root = (async () => {
      const local = path.join(process.cwd(), ".blueprint-deps", dep.name);
      if ((await versionAt(local)) === dep.version) return local;
      const cached = path.join(CACHE_DIR, key.replace("/", "__"));
      if ((await versionAt(cached)) === dep.version) return cached;
      return download(dep, cached);
    })();
    root.catch(() => roots.delete(key));
    roots.set(key, root);
  }
  return root;
}

/** Resolves `@openzeppelin/contracts/...` style unit names to pinned sources. */
export function dependencyReader(): SourceReader {
  const deps = pinnedDependencies();
  return async (unit) => {
    const dep = deps.find((d) => unit.startsWith(`${d.name}/`));
    if (!dep) return undefined;
    const rel = unit.slice(dep.name.length + 1);
    if (!rel.endsWith(".sol") || !isSafeUnitPath(rel)) return undefined;
    const root = await packageRoot(dep);
    return fs.readFile(path.join(root, rel), "utf8").catch(() => undefined);
  };
}

/** Shared contracts that ship with the repo, such as the Teleporter interfaces. */
export function sharedContractsReader(root = process.cwd()): SourceReader {
  return async (unit) => {
    if (!unit.startsWith("blueprints/_shared/contracts/") || !unit.endsWith(".sol") || !isSafeUnitPath(unit)) return undefined;
    return fs.readFile(path.join(root, unit), "utf8").catch(() => undefined);
  };
}
