import type { AstNode } from "./ast";
import { auditUnits, type AuditOptions } from "./index";
import type { AuditReport } from "./types";

/** Audits `files` from a compiled build, resolving inherited code from every other unit it contains. */
export function auditBuild(
  build: { compiler: string; sources: Record<string, string>; asts: Record<string, AstNode> },
  files: string[],
  options: Omit<AuditOptions, "context" | "compiler"> = {},
): AuditReport {
  const audited = new Set(files);
  const units = files
    .filter((file) => build.asts[file])
    .map((file) => ({ path: file, source: build.sources[file], ast: build.asts[file] }));
  const context = Object.entries(build.asts)
    .filter(([file]) => !audited.has(file))
    .map(([, ast]) => ast);
  return auditUnits(units, { ...options, context, compiler: build.compiler });
}
