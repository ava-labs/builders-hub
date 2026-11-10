import { OWASP_2026, type AuditReport, type Finding } from "./types";

const location = (f: Finding) => `${f.file}:${f.line}${f.contract ? ` (${f.contract}${f.function ? `.${f.function}` : ""})` : ""}`;

/** Compact markdown the agent reads back after an audit run. */
export function formatReportForModel(report: AuditReport): string {
  const acked = new Map(report.acknowledged.map((a) => [a.fingerprint, a.reason]));
  const lines = [
    `Static audit (${report.tool.name} ${report.tool.version}, ${report.tool.detectors} detectors): ${report.passed ? "PASSED" : "BLOCKED"}.`,
    `Counts: ${Object.entries(report.counts)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${n} ${s}`)
      .join(", ") || "no findings"}.`,
  ];
  for (const f of report.findings) {
    lines.push(
      "",
      `- [${f.severity.toUpperCase()}] ${f.title} (${f.detector}, OWASP ${f.category} ${OWASP_2026[f.category]}) at ${location(f)}`,
      `  ${f.message}`,
      `  \`${f.snippet}\``,
      `  Fix: ${f.recommendation}`,
      `  Fingerprint: ${f.fingerprint}${acked.has(f.fingerprint) ? ` (acknowledged: ${acked.get(f.fingerprint)})` : ""}`,
    );
  }
  return lines.join("\n");
}

/** Plain text for terminals and CI logs. */
export function formatReportText(report: AuditReport, label?: string): string {
  const header = `${label ? `${label}: ` : ""}${report.passed ? "pass" : "BLOCKED"} — ${
    Object.entries(report.counts)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${n} ${s}`)
      .join(", ") || "no findings"
  }`;
  const rows = report.findings.map((f) => `  ${f.severity.padEnd(8)} ${f.detector.padEnd(28)} ${location(f)}\n           ${f.message}`);
  return [header, ...rows].join("\n");
}
