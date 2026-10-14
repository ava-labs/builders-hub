/**
 * Compiles every blueprint's reference contracts with the shared settings and
 * runs the Studio audit over them. Exits non-zero on a compile error or any
 * unacknowledged critical or high finding.
 *
 *   npm run blueprints:audit            human-readable
 *   npm run blueprints:audit -- --json  one JSON report per blueprint
 */
import { listBlueprintIds, loadBlueprint } from "@/lib/blueprints";
import { auditBuild } from "@/lib/studio/audit/build";
import { formatReportText } from "@/lib/studio/audit/format";
import type { AuditReport } from "@/lib/studio/audit/types";
import { compileSources } from "@/lib/studio/compile";

async function main() {
  const json = process.argv.includes("--json");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const results: { id: string; ok: boolean; errors?: string[]; report?: AuditReport }[] = [];

  for (const id of listBlueprintIds()) {
    if (only.length && !only.includes(id)) continue;
    const blueprint = loadBlueprint(id);
    const entries = Object.fromEntries(
      blueprint.sources.filter((s) => s.path.endsWith(".sol")).map((s) => [`blueprints/${id}/${s.path}`, s.content]),
    );
    if (Object.keys(entries).length === 0) continue;

    const build = await compileSources(entries);
    if (!build.ok) {
      const errors = build.diagnostics.filter((d) => d.severity === "error").map((d) => d.formatted ?? d.message);
      results.push({ id, ok: false, errors });
      if (!json) console.log(`${id}: COMPILE FAILED\n${errors.join("\n")}`);
      continue;
    }
    const report = auditBuild(build, Object.keys(entries));
    results.push({ id, ok: report.passed, report });
    if (!json) console.log(formatReportText(report, id));
  }

  if (json) console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (!json) console.log(`\n${results.length - failed.length}/${results.length} blueprints pass the audit gate.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
