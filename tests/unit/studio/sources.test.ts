import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCompilerDefaults } from "@/lib/blueprints";
import {
  MissingImportError,
  collectSources,
  importsOf,
  isSafeUnitPath,
  lineColumn,
  parseRemappings,
  resolveImport,
  stripComments,
} from "@/lib/studio/sources";
import { untar } from "@/lib/studio/tar";

const remappings = parseRemappings(loadCompilerDefaults().remappings);

describe("import resolution", () => {
  it("finds every import form and ignores commented-out ones", () => {
    const source = [
      'import "./A.sol";',
      'import {B, C as D} from "@openzeppelin/contracts/B.sol";',
      'import * as E from "../E.sol";',
      'import "./F.sol" as F;',
      '// import "./Commented.sol";',
      '/* import "./Block.sol"; */',
      'string constant URL = "https://example.com//not-a-comment";',
    ].join("\n");
    expect(importsOf(source)).toEqual(["./A.sol", "@openzeppelin/contracts/B.sol", "../E.sol", "./F.sol"]);
    expect(stripComments(source)).toContain('"https://example.com//not-a-comment"');
    expect(stripComments(source).length).toBe(source.length);
  });

  it("names units the way solc does", () => {
    expect(resolveImport("blueprints/x/contracts/A.sol", "./Lib.sol", remappings)).toBe("blueprints/x/contracts/Lib.sol");
    expect(resolveImport("@openzeppelin/contracts/token/ERC20/ERC20.sol", "./IERC20.sol", remappings)).toBe(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol",
    );
    expect(resolveImport("@chainlink/contracts-ccip/contracts/a/B.sol", "@openzeppelin/contracts@5.3.0/utils/X.sol", remappings)).toBe(
      "@openzeppelin/contracts/utils/X.sol",
    );
    expect(resolveImport("contracts/A.sol", "@teleporter/ITeleporterMessenger.sol", remappings)).toBe(
      "blueprints/_shared/contracts/teleporter/ITeleporterMessenger.sol",
    );
  });

  it("rejects unit paths that could escape a directory", () => {
    expect(isSafeUnitPath("contracts/A.sol")).toBe(true);
    expect(isSafeUnitPath("../A.sol")).toBe(false);
    expect(isSafeUnitPath("contracts/../../etc/passwd")).toBe(false);
    expect(isSafeUnitPath("/abs/A.sol")).toBe(false);
    expect(isSafeUnitPath("contracts//A.sol")).toBe(false);
  });

  it("collects transitive imports and reports what is missing", async () => {
    const disk: Record<string, string> = {
      "contracts/Lib.sol": 'import "@openzeppelin/contracts/utils/Math.sol";',
      "@openzeppelin/contracts/utils/Math.sol": "library Math {}",
    };
    const read = async (unit: string) => disk[unit];
    const sources = await collectSources({ "contracts/A.sol": 'import "./Lib.sol";' }, read, { remappings: [] });
    expect(Object.keys(sources).sort()).toEqual(["@openzeppelin/contracts/utils/Math.sol", "contracts/A.sol", "contracts/Lib.sol"]);

    await expect(collectSources({ "contracts/A.sol": 'import "./Nope.sol";' }, read, { remappings: [] })).rejects.toBeInstanceOf(
      MissingImportError,
    );
    await expect(collectSources({ "A.sol": 'import "../../secret.sol";' }, read, { remappings: [] })).rejects.toThrow(/secret\.sol/);
  });

  it("maps solc byte offsets past non-ASCII text", () => {
    const source = "// café —\ncontract A {}";
    const offset = new TextEncoder().encode("// café —\n").length;
    expect(lineColumn(source, offset)).toEqual({ line: 2, column: 1 });
  });
});

function tarEntry(name: string, content: string, type = "0"): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const header = new Uint8Array(512);
  header.set(encoder.encode(name.slice(0, 100)), 0);
  header.set(encoder.encode(`${data.length.toString(8).padStart(11, "0")}\0`), 124);
  header[156] = type.charCodeAt(0);
  header.set(encoder.encode("ustar\0"), 257);
  const body = new Uint8Array(Math.ceil(data.length / 512) * 512);
  body.set(data);
  const out = new Uint8Array(512 + body.length);
  out.set(header);
  out.set(body, 512);
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0) + 1024);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

describe("untar", () => {
  it("reads regular files, including PAX long names", () => {
    const long = `package/${"deep/".repeat(30)}Long.sol`;
    const archive = concat(
      tarEntry("package/contracts/A.sol", "contract A {}"),
      tarEntry("package/dir", "", "5"),
      // The reader takes the path from the record and does not need the length prefix to be exact.
      tarEntry("PaxHeader", `999 path=${long}\n`, "x"),
      tarEntry("truncated-name", "contract Long {}"),
    );
    const entries = [...untar(archive)].map((e) => [e.path, new TextDecoder().decode(e.data)]);
    expect(entries).toEqual([
      ["package/contracts/A.sol", "contract A {}"],
      [long, "contract Long {}"],
    ]);
  });
});

describe("pinned dependencies", () => {
  it("match between compiler.json and the Foundry setup script", () => {
    const compiler = loadCompilerDefaults();
    const script = fs.readFileSync(path.join(process.cwd(), "scripts/blueprints/setup-test-deps.sh"), "utf8");
    const value = (name: string) => new RegExp(`^${name}="([^"]+)"`, "m").exec(script)?.[1];
    expect(value("OZ_VERSION")).toBe(compiler.dependencies["@openzeppelin/contracts"]);
    expect(value("OZ_SHA256")).toBe(compiler.integrity["@openzeppelin/contracts"]);
    expect(value("CCIP_VERSION")).toBe(compiler.dependencies["@chainlink/contracts-ccip"]);
    expect(value("CCIP_SHA256")).toBe(compiler.integrity["@chainlink/contracts-ccip"]);
  });
});
