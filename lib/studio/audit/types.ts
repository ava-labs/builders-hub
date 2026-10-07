/**
 * Shared shapes for the Studio audit suite. Kept free of imports so client
 * components can render reports without pulling in the analyzer.
 */

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Severities that block a deploy until fixed or explicitly acknowledged. */
export const BLOCKING_SEVERITIES: readonly Severity[] = ["critical", "high"];

/** OWASP Smart Contract Top 10, 2026 edition. */
export const OWASP_2026 = {
  SC01: "Access Control Vulnerabilities",
  SC02: "Business Logic Vulnerabilities",
  SC03: "Price Oracle Manipulation",
  SC04: "Flash Loan–Facilitated Attacks",
  SC05: "Lack of Input Validation",
  SC06: "Unchecked External Calls",
  SC07: "Arithmetic Errors",
  SC08: "Reentrancy Attacks",
  SC09: "Integer Overflow and Underflow",
  SC10: "Proxy & Upgradeability Vulnerabilities",
} as const;
export type OwaspCategory = keyof typeof OWASP_2026;

export interface DetectorInfo {
  id: string;
  title: string;
  /** Severity when the detector does not refine it per finding. */
  severity: Severity;
  category: OwaspCategory;
  description: string;
  recommendation: string;
}

export interface Finding {
  detector: string;
  title: string;
  severity: Severity;
  category: OwaspCategory;
  message: string;
  recommendation: string;
  file: string;
  line: number;
  column: number;
  contract?: string;
  function?: string;
  snippet: string;
  /** Stable across edits elsewhere in the file: no line numbers go into it. */
  fingerprint: string;
}

export interface Acknowledgement {
  fingerprint: string;
  reason: string;
}

export interface AuditReport {
  tool: { name: string; version: string; detectors: number };
  compiler?: string;
  files: string[];
  findings: Finding[];
  counts: Record<Severity, number>;
  acknowledged: Acknowledgement[];
  /** No blocking finding is left unacknowledged. */
  passed: boolean;
  generatedAt: string;
}
