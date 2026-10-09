/**
 * Compiles the audit fixtures and stores their ASTs, so the detector tests run
 * without a compiler download. Rerun after editing any fixture:
 *
 *   npm run studio:audit-fixtures
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { compileStandardJson, fatalErrors } from "@/lib/verification/solc";

const DIR = path.join(process.cwd(), "tests/unit/studio/audit/fixtures");
const COMPILER = "0.8.28";

// Compiler metadata no detector reads; dropping it keeps the committed fixture small.
const UNUSED_KEYS = new Set([
  "typeIdentifier",
  "nameLocation",
  "nameLocations",
  "documentation",
  "exportedSymbols",
  "license",
  "absolutePath",
  "symbolAliases",
  "typeName",
  "argumentTypes",
  "isConstant",
  "isLValue",
  "isPure",
  "lValueRequested",
  "overloadedDeclarations",
  "contractDependencies",
  "usedErrors",
  "usedEvents",
  "canonicalName",
  "fullyImplemented",
  "baseFunctions",
  "baseContracts",
  "functionSelector",
  "eventSelector",
  "errorSelector",
  "hexValue",
  "internalFunctionIDs",
  "overrides",
  "virtual",
  "implemented",
]);

function slim(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(slim);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UNUSED_KEYS.has(key))
        .map(([key, v]) => [key, slim(v)]),
    );
  }
  return value;
}

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sol")).sort();
  const contents = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(DIR, f), "utf8")]));
  const { output, longVersion } = await compileStandardJson({
    compilerVersion: COMPILER,
    stdJsonInput: {
      language: "Solidity",
      sources: Object.fromEntries(files.map((f) => [f, { content: contents[f] }])),
      settings: { evmVersion: "cancun", outputSelection: { "*": { "": ["ast"] } } },
    },
  });

  const errors = fatalErrors(output);
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage ?? e.message);
    process.exit(1);
  }

  const sources = output.sources as Record<string, { id: number; ast: unknown }>;
  const fixture = {
    compiler: longVersion,
    sources: Object.fromEntries(
      files.map((f) => [f, { sha256: createHash("sha256").update(contents[f]).digest("hex"), ast: slim(sources[f].ast) }]),
    ),
  };
  fs.writeFileSync(path.join(DIR, "asts.json"), `${JSON.stringify(fixture)}\n`);
  console.log(`Wrote ${files.length} ASTs compiled with ${longVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
