import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AstNode } from "@/lib/studio/audit/ast";
import { auditUnits, blockingFindings, detectorCatalog, type AuditUnit } from "@/lib/studio/audit";
import { formatReportForModel } from "@/lib/studio/audit/format";

const DIR = path.join(__dirname, "fixtures");
const fixture = JSON.parse(fs.readFileSync(path.join(DIR, "asts.json"), "utf8")) as {
  compiler: string;
  sources: Record<string, { sha256: string; ast: AstNode }>;
};

function unit(file: string): AuditUnit {
  return { path: file, source: fs.readFileSync(path.join(DIR, file), "utf8"), ast: fixture.sources[file].ast };
}

const stubs = unit("Stubs.sol");
const vulnerable = auditUnits([unit("Vulnerable.sol")], { context: [stubs.ast] });
const safe = auditUnits([unit("Safe.sol")], { context: [stubs.ast] });

const pascal = (id: string) => id.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

describe("audit fixtures", () => {
  it("were compiled from the current sources", () => {
    for (const [file, { sha256 }] of Object.entries(fixture.sources)) {
      const actual = createHash("sha256").update(fs.readFileSync(path.join(DIR, file), "utf8")).digest("hex");
      expect(actual, `${file} changed; run npm run studio:audit-fixtures`).toBe(sha256);
    }
  });
});

describe("detectors", () => {
  it.each(detectorCatalog().map((d) => [d.id, d] as const))("%s fires on its vulnerable fixture", (id, info) => {
    const hits = vulnerable.findings.filter((f) => f.detector === id && f.contract === pascal(id));
    expect(hits.length, `${id} did not fire in contract ${pascal(id)}`).toBeGreaterThan(0);
    expect(hits.map((h) => h.severity)).toContain(info.severity);
    for (const hit of hits) {
      expect(hit.line).toBeGreaterThan(0);
      expect(hit.snippet.length).toBeGreaterThan(0);
    }
  });

  it("report nothing on the safe fixture", () => {
    expect(safe.findings.map((f) => `${f.detector} ${f.contract}.${f.function} ${f.file}:${f.line} ${f.message}`)).toEqual([]);
    expect(safe.passed).toBe(true);
  });

  it("map every detector to an OWASP 2026 category", () => {
    for (const d of detectorCatalog()) expect(d.category).toMatch(/^SC(0[1-9]|10)$/);
    expect(new Set(detectorCatalog().map((d) => d.category)).size).toBe(10);
  });

  it("point at the right line", () => {
    const [hit] = vulnerable.findings.filter((f) => f.detector === "tx-origin-auth");
    const lines = fs.readFileSync(path.join(DIR, "Vulnerable.sol"), "utf8").split("\n");
    expect(lines[hit.line - 1]).toContain("tx.origin == owner");
    expect(hit.snippet).toBe('require(tx.origin == owner, "not owner");');
  });
});

describe("report gate", () => {
  it("blocks on critical and high findings until each is acknowledged with a reason", () => {
    expect(vulnerable.passed).toBe(false);
    const blocking = blockingFindings(vulnerable);
    expect(blocking.length).toBeGreaterThan(0);

    const partial = auditUnits([unit("Vulnerable.sol")], {
      context: [stubs.ast],
      acknowledged: blocking.slice(1).map((f) => ({ fingerprint: f.fingerprint, reason: "accepted for the fixture" })),
    });
    expect(partial.passed).toBe(false);

    const all = auditUnits([unit("Vulnerable.sol")], {
      context: [stubs.ast],
      acknowledged: blocking.map((f) => ({ fingerprint: f.fingerprint, reason: "accepted for the fixture" })),
    });
    expect(all.passed).toBe(true);

    const blank = auditUnits([unit("Vulnerable.sol")], {
      context: [stubs.ast],
      acknowledged: blocking.map((f) => ({ fingerprint: f.fingerprint, reason: "  " })),
    });
    expect(blank.passed).toBe(false);
  });

  it("keeps fingerprints stable and unique", () => {
    const again = auditUnits([unit("Vulnerable.sol")], { context: [stubs.ast] });
    expect(again.findings.map((f) => f.fingerprint)).toEqual(vulnerable.findings.map((f) => f.fingerprint));
    expect(new Set(vulnerable.findings.map((f) => f.fingerprint)).size).toBe(vulnerable.findings.length);
  });

  it("formats a report the model can act on", () => {
    const text = formatReportForModel(vulnerable);
    expect(text).toContain("BLOCKED");
    expect(text).toContain("OWASP SC08 Reentrancy Attacks");
    expect(text).toContain("Fix:");
  });
});
