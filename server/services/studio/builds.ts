import "server-only";
import { Prisma } from "@prisma/client";
import { keccak256, type Hex } from "viem";
import { prisma } from "@/prisma/prisma";
import { auditBuild } from "@/lib/studio/audit/build";
import { BLOCKING_SEVERITIES, type AuditReport, type Finding } from "@/lib/studio/audit/types";
import { compileSources, type Diagnostic } from "@/lib/studio/compile";
import { MissingImportError, SourceLimitError } from "@/lib/studio/sources";
import { CompileError } from "@/lib/verification/solc";
import { StudioError } from "./errors";
import { filesHash } from "./files";
import { getOwnedProject } from "./projects";

export interface StoredContract {
  file: string;
  name: string;
  abi: unknown[];
  bytecode: Hex;
  bytecodeHash: Hex;
  /** False for interfaces, abstract contracts and anything that needs library linking. */
  deployable: boolean;
}

export interface StoredAcknowledgement {
  fingerprint: string;
  reason: string;
  at: string;
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Compiles the project's contracts/ and audits the result. A build that fails to compile is stored too, with its diagnostics. */
export async function buildProject(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  const files = await prisma.studioFile.findMany({
    where: { project_id: project.id, path: { startsWith: "contracts/" } },
    select: { path: true, content: true, sha256: true },
  });
  const solidity = files.filter((f) => f.path.endsWith(".sol"));
  if (solidity.length === 0) throw new StudioError(400, "Add a contract under contracts/ first");
  const entries = Object.fromEntries(solidity.map((f) => [f.path, f.content]));
  const hash = filesHash(solidity);

  let compiled: Awaited<ReturnType<typeof compileSources>> | undefined;
  let diagnostics: Diagnostic[] = [];
  try {
    compiled = await compileSources(entries);
    diagnostics = compiled.diagnostics;
  } catch (error) {
    if (error instanceof MissingImportError || error instanceof SourceLimitError) {
      diagnostics = [{ severity: "error", message: error.message }];
    } else if (error instanceof CompileError) {
      throw new StudioError(503, `The compiler is unavailable: ${error.message}`);
    } else {
      throw error;
    }
  }

  const contracts: StoredContract[] = (compiled?.contracts ?? []).map((c) => ({
    file: c.file,
    name: c.name,
    abi: c.abi,
    bytecode: c.bytecode,
    bytecodeHash: keccak256(c.bytecode),
    deployable: c.bytecode !== "0x" && Object.keys(c.linkReferences).length === 0,
  }));

  const build = await prisma.studioBuild.create({
    data: {
      project_id: project.id,
      files_hash: hash,
      compiler: compiled?.compiler ?? "",
      ok: !!compiled?.ok,
      diagnostics: json(diagnostics),
      contracts: json(contracts),
    },
  });

  if (!compiled?.ok) return { build, audit: null, report: null };

  // Acknowledgements follow a finding across builds: fingerprints ignore line numbers.
  const previous = await prisma.studioAuditReport.findFirst({ where: { project_id: project.id }, orderBy: { created_at: "desc" } });
  const carried = ((previous?.acknowledged ?? []) as unknown as StoredAcknowledgement[]).filter((a) => a.reason.trim().length > 0);
  const report = auditBuild(compiled, Object.keys(entries), { acknowledged: carried });
  const kept = carried.filter((a) => report.acknowledged.some((r) => r.fingerprint === a.fingerprint));

  const audit = await prisma.studioAuditReport.create({
    data: {
      project_id: project.id,
      build_id: build.id,
      passed: report.passed,
      counts: json(report.counts),
      findings: json(report.findings),
      acknowledged: json(kept),
      tool_version: report.tool.version,
    },
  });
  await prisma.studioProject.update({ where: { id: project.id }, data: { updated_at: new Date() } });
  return { build, audit, report };
}

export const openBlocking = (findings: Finding[], acknowledged: { fingerprint: string }[]) => {
  const acked = new Set(acknowledged.map((a) => a.fingerprint));
  return findings.filter((f) => BLOCKING_SEVERITIES.includes(f.severity) && !acked.has(f.fingerprint));
};

/** Only the builder acknowledges findings, from the UI; the agent can propose a reason but not record it. */
export async function acknowledgeFinding(userId: string, projectId: string, auditId: string, fingerprint: string, reason: string) {
  const project = await getOwnedProject(userId, projectId);
  const audit = await prisma.studioAuditReport.findFirst({ where: { id: auditId, project_id: project.id } });
  if (!audit) throw new StudioError(404, "Audit report not found");
  const findings = audit.findings as unknown as Finding[];
  if (!findings.some((f) => f.fingerprint === fingerprint)) throw new StudioError(400, "That finding is not in this report");

  const acknowledged = [
    ...(audit.acknowledged as unknown as StoredAcknowledgement[]).filter((a) => a.fingerprint !== fingerprint),
    { fingerprint, reason, at: new Date().toISOString() },
  ];
  return prisma.studioAuditReport.update({
    where: { id: audit.id },
    data: { acknowledged: json(acknowledged), passed: openBlocking(findings, acknowledged).length === 0 },
  });
}

export async function recordReview(userId: string, projectId: string, items: { id: string; status: string; evidence: string }[]) {
  const project = await getOwnedProject(userId, projectId);
  const audit = await prisma.studioAuditReport.findFirst({ where: { project_id: project.id }, orderBy: { created_at: "desc" } });
  if (!audit) throw new StudioError(409, "Build and audit the project before recording the review");
  return prisma.studioAuditReport.update({ where: { id: audit.id }, data: { review: json(items) } });
}

export async function latestBuild(projectId: string, { ok }: { ok?: boolean } = {}) {
  return prisma.studioBuild.findFirst({ where: { project_id: projectId, ...(ok !== undefined ? { ok } : {}) }, orderBy: { created_at: "desc" } });
}

export type BuildResult = Awaited<ReturnType<typeof buildProject>>;
export type { AuditReport };
