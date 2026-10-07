import { AstIndex, type AstNode, child, list, srcRange, str, walk } from "./ast";
import { DETECTORS, type AuditUnit, type Detector, type DetectorContext, type FunctionInfo, type NodeInfo, type RawFinding } from "./detectors";
import {
  BLOCKING_SEVERITIES,
  SEVERITIES,
  type Acknowledgement,
  type AuditReport,
  type DetectorInfo,
  type Finding,
  type Severity,
} from "./types";

export type { AuditUnit } from "./detectors";
export * from "./types";

export const AUDIT_TOOL = { name: "builder-hub-audit", version: "1.0.0" } as const;

export interface AuditOptions {
  /** Every other unit the compiler saw, so inherited code such as OpenZeppelin bases resolves. */
  context?: AstNode[];
  acknowledged?: Acknowledgement[];
  compiler?: string;
  /** Run only these detector ids. */
  detectors?: string[];
  now?: Date;
}

export function detectorCatalog(): DetectorInfo[] {
  return DETECTORS.map(({ id, title, severity, category, description, recommendation }) => ({
    id,
    title,
    severity,
    category,
    description,
    recommendation,
  }));
}

export function auditUnits(units: AuditUnit[], options: AuditOptions = {}): AuditReport {
  const index = new AstIndex([...(options.context ?? []), ...units.map((u) => u.ast)]);
  const ctx = buildContext(units, index);
  const detectors = options.detectors ? DETECTORS.filter((d) => options.detectors!.includes(d.id)) : DETECTORS;

  const byFingerprint = new Map<string, Finding>();
  for (const detector of detectors) {
    for (const raw of detector.run(ctx)) {
      const f = toFinding(detector, raw);
      if (!byFingerprint.has(f.fingerprint)) byFingerprint.set(f.fingerprint, f);
    }
  }
  const findings = [...byFingerprint.values()].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line,
  );

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const f of findings) counts[f.severity]++;

  const present = new Set(findings.map((f) => f.fingerprint));
  const acknowledged = (options.acknowledged ?? []).filter((a) => present.has(a.fingerprint) && a.reason.trim().length > 0);
  const ackSet = new Set(acknowledged.map((a) => a.fingerprint));

  return {
    tool: { ...AUDIT_TOOL, detectors: detectors.length },
    compiler: options.compiler,
    files: units.map((u) => u.path),
    findings,
    counts,
    acknowledged,
    passed: findings.every((f) => !BLOCKING_SEVERITIES.includes(f.severity) || ackSet.has(f.fingerprint)),
    generatedAt: (options.now ?? new Date()).toISOString(),
  };
}

export const severityRank = (s: Severity) => SEVERITIES.indexOf(s);

export const blockingFindings = (report: AuditReport) => {
  const acked = new Set(report.acknowledged.map((a) => a.fingerprint));
  return report.findings.filter((f) => BLOCKING_SEVERITIES.includes(f.severity) && !acked.has(f.fingerprint));
};

/* ------------------------------- context ------------------------------- */

function isEntry(fn: AstNode, contract: AstNode): boolean {
  const kind = str(contract, "contractKind");
  if (kind === "library" || kind === "interface") return false;
  return (
    ["function", "receive", "fallback"].includes(str(fn, "kind") ?? "") &&
    ["public", "external"].includes(str(fn, "visibility") ?? "") &&
    !!child(fn, "body")
  );
}

function buildContext(units: AuditUnit[], index: AstIndex): DetectorContext {
  const contracts: DetectorContext["contracts"] = [];
  const functions: FunctionInfo[] = [];
  const nodes: NodeInfo[] = [];
  const infoOf = new Map<AstNode, FunctionInfo>();

  for (const unit of units) {
    for (const contract of list(unit.ast, "nodes").filter((n) => n.nodeType === "ContractDefinition")) {
      contracts.push({ unit, contract });
      for (const fn of list(contract, "nodes").filter((n) => n.nodeType === "FunctionDefinition")) {
        const info: FunctionInfo = {
          unit,
          contract,
          fn,
          body: child(fn, "body"),
          entry: isEntry(fn, contract),
          mutates: !["view", "pure"].includes(str(fn, "stateMutability") ?? ""),
          params: new Set(list(child(fn, "parameters"), "parameters").map((p) => p.id)),
        };
        functions.push(info);
        infoOf.set(fn, info);
      }
    }

    walk(unit.ast, (node, ancestors) => {
      let fn: FunctionInfo | undefined;
      let contract: AstNode | undefined;
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const a = ancestors[i];
        if (!fn && a.nodeType === "FunctionDefinition") fn = infoOf.get(a);
        if (a.nodeType === "ContractDefinition") {
          contract = a;
          break;
        }
      }
      nodes.push({ node, ancestors: [...ancestors], unit, contract, fn });
    });
  }
  return { index, units, contracts, functions, nodes };
}

/* ------------------------------ locations ------------------------------ */

interface LineTable {
  bytes: Uint8Array;
  starts: number[];
}

const lineTables = new WeakMap<AuditUnit, LineTable>();

function lineTable(unit: AuditUnit): LineTable {
  let table = lineTables.get(unit);
  if (!table) {
    // solc reports byte offsets, which drift from string indices after any non-ASCII character.
    const bytes = new TextEncoder().encode(unit.source);
    const starts = [0];
    for (let i = 0; i < bytes.length; i++) if (bytes[i] === 10) starts.push(i + 1);
    table = { bytes, starts };
    lineTables.set(unit, table);
  }
  return table;
}

function locate(unit: AuditUnit, offset: number): { line: number; column: number; text: string } {
  const { bytes, starts } = lineTable(unit);
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  const end = lo + 1 < starts.length ? starts[lo + 1] - 1 : bytes.length;
  const text = new TextDecoder().decode(bytes.subarray(starts[lo], end));
  return { line: lo + 1, column: offset - starts[lo] + 1, text };
}

/** FNV-1a, 64-bit: stable, dependency-free, and good enough to key acknowledgements. */
function fnv64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

function toFinding(detector: Detector, raw: RawFinding): Finding {
  const { start } = srcRange(raw.node);
  const { line, column, text } = locate(raw.unit, start);
  const snippet = text.trim().slice(0, 200);
  const contract = str(raw.contract, "name");
  const fnName = raw.fn ? str(raw.fn, "name") || str(raw.fn, "kind") : undefined;
  return {
    detector: detector.id,
    title: detector.title,
    severity: raw.severity ?? detector.severity,
    category: detector.category,
    message: raw.message,
    recommendation: detector.recommendation,
    file: raw.unit.path,
    line,
    column,
    contract,
    function: fnName,
    snippet,
    fingerprint: fnv64([detector.id, raw.unit.path, contract ?? "", fnName ?? "", snippet.replace(/\s+/g, " "), raw.message].join("|")),
  };
}
