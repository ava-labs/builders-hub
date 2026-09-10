import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compileStandardJson,
  compileWithCompilerAt,
  fatalErrors,
  resolveCompilerVersion,
  toCompilerInput,
} from "@/lib/verification/solc";
import { matchDeployedBytecode } from "@/lib/verification/match";

/*
 * These reach binaries.soliditylang.org and then run a real compiler, so
 * they are opt-in:
 *
 *   VERIFY_SOLC_E2E=1 npx vitest run tests/unit/verification
 *
 * They are worth running whenever solc.ts changes, because the loader is
 * the part of this system that cannot be unit tested honestly — the whole
 * question is whether an unfamiliar emscripten build actually compiles.
 */

const enabled = process.env.VERIFY_SOLC_E2E === "1";
const describeE2E = enabled ? describe : describe.skip;

const COMPILER = "0.8.24+commit.e11b9ed9";

const STORAGE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Storage {
    uint256 private value;

    function set(uint256 next) public {
        value = next;
    }

    function get() public view returns (uint256) {
        return value;
    }
}
`;

const INPUT = {
  language: "Solidity",
  sources: { "contracts/Storage.sol": { content: STORAGE } },
  settings: {
    optimizer: { enabled: false, runs: 200 },
    outputSelection: {
      "*": { "*": ["abi", "metadata", "evm.bytecode.object", "evm.deployedBytecode.object"] },
    },
  },
};

describe("toCompilerInput", () => {
  it("drops the extra keys Foundry's build-info carries", () => {
    // Exactly the shape `forge build --build-info` writes. solc answers an
    // input like this with `Unknown key "allowPaths"` and never compiles.
    const buildInfoInput = {
      version: 1,
      language: "Solidity",
      sources: { "src/Storage.sol": { content: STORAGE } },
      settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "shanghai" },
      allowPaths: [],
      basePath: "/tmp/verify-demo",
      includePaths: [],
    };

    expect(Object.keys(toCompilerInput(buildInfoInput)).sort()).toEqual([
      "language",
      "settings",
      "sources",
    ]);
  });

  it("passes settings through untouched, since that is where codegen lives", () => {
    const settings = { optimizer: { enabled: true, runs: 999 }, viaIR: true, libraries: {} };
    expect(toCompilerInput({ language: "Solidity", sources: {}, settings }).settings).toBe(settings);
  });

  it("defaults the language rather than omitting it", () => {
    expect(toCompilerInput({ sources: {} }).language).toBe("Solidity");
  });

  it("leaves out settings entirely when there were none", () => {
    expect(toCompilerInput({ sources: {} })).not.toHaveProperty("settings");
  });
});

describeE2E("solc loader", () => {
  it("resolves a long version against the official build list", async () => {
    const build = await resolveCompilerVersion(`v${COMPILER}`);
    expect(build.longVersion).toBe(COMPILER);
    expect(build.path).toContain("soljson");
  }, 60_000);

  it("resolves a bare release to its canonical build", async () => {
    const build = await resolveCompilerVersion("0.8.24");
    expect(build.longVersion).toBe(COMPILER);
  }, 60_000);

  it("refuses a version that is not in the list", async () => {
    await expect(resolveCompilerVersion("0.8.99")).rejects.toThrow(/Unknown compiler version/);
    // The version string is caller-controlled and must never reach a URL.
    await expect(resolveCompilerVersion("../../etc/passwd")).rejects.toThrow(/Not a Solidity version/);
  }, 60_000);

  it("compiles a contract and produces matching runtime bytecode", async () => {
    const { output, longVersion } = await compileStandardJson({
      stdJsonInput: INPUT,
      compilerVersion: COMPILER,
    });

    expect(longVersion).toBe(COMPILER);
    expect(fatalErrors(output)).toEqual([]);

    const deployed = output.contracts?.["contracts/Storage.sol"]?.Storage?.evm?.deployedBytecode?.object;
    expect(deployed).toBeTruthy();

    // Feed the compiler's own output back in as if it were on chain: the
    // matcher must call that an exact match, or nothing else can work.
    const result = matchDeployedBytecode({
      output,
      identifier: "contracts/Storage.sol:Storage",
      onchainCode: `0x${deployed}`,
    });
    expect(result).toMatchObject({ matched: true, level: "exact_match" });
  }, 240_000);

  it("reports a source error as compiler output rather than throwing", async () => {
    const { output } = await compileStandardJson({
      stdJsonInput: {
        ...INPUT,
        sources: { "contracts/Broken.sol": { content: "pragma solidity ^0.8.0; contract Broken {" } },
      },
      compilerVersion: COMPILER,
    });

    // A submitter's broken source is a result, not a failure of ours.
    expect(fatalErrors(output).length).toBeGreaterThan(0);
  }, 240_000);
});

/*
 * The same proof without the network: point VERIFY_SOLC_BINARY at a
 * soljson-*.js you already have and this exercises the worker, the
 * emscripten loading shim, and the compile itself.
 *
 *   curl -o /tmp/soljson.js https://binaries.soliditylang.org/wasm/soljson-v0.8.24+commit.e11b9ed9.js
 *   VERIFY_SOLC_BINARY=/tmp/soljson.js npx vitest run tests/unit/verification
 */
const localCompiler = process.env.VERIFY_SOLC_BINARY;
const describeLocal = localCompiler && existsSync(localCompiler) ? describe : describe.skip;

describeLocal("solc worker against a local build", () => {
  it("compiles and round-trips through the matcher", async () => {
    const output = await compileWithCompilerAt(localCompiler!, INPUT);

    expect(fatalErrors(output)).toEqual([]);
    const deployed = output.contracts?.["contracts/Storage.sol"]?.Storage?.evm?.deployedBytecode?.object;
    expect(deployed).toBeTruthy();

    const result = matchDeployedBytecode({
      output,
      identifier: "contracts/Storage.sol:Storage",
      onchainCode: `0x${deployed}`,
    });
    expect(result).toMatchObject({ matched: true, level: "exact_match" });
  }, 240_000);

  it("surfaces a source error without throwing", async () => {
    const output = await compileWithCompilerAt(localCompiler!, {
      ...INPUT,
      sources: { "contracts/Broken.sol": { content: "pragma solidity ^0.8.0; contract Broken {" } },
    });

    expect(fatalErrors(output).length).toBeGreaterThan(0);
  }, 240_000);

  it("compiles a build-info input only once the extra keys are dropped", async () => {
    const buildInfoInput = {
      version: 1,
      ...INPUT,
      allowPaths: [],
      basePath: "/tmp/verify-demo",
      includePaths: [],
    };

    // The bug this guards: solc refuses the whole input over a key it does
    // not define, before compiling anything.
    const asIs = await compileWithCompilerAt(localCompiler!, buildInfoInput);
    expect(fatalErrors(asIs).map((e) => e.message).join("\n")).toMatch(/allowPaths/);

    const reduced = await compileWithCompilerAt(localCompiler!, toCompilerInput(buildInfoInput));
    expect(fatalErrors(reduced)).toEqual([]);
    expect(
      reduced.contracts?.["contracts/Storage.sol"]?.Storage?.evm?.deployedBytecode?.object,
    ).toBeTruthy();
  }, 240_000);
});
