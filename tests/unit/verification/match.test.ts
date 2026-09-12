import { describe, expect, it } from "vitest";
import { listCompiledContracts, matchDeployedBytecode, splitContractIdentifier } from "@/lib/verification/match";
import type { SolcOutput } from "@/lib/verification/solc";

/*
 * The matcher decides whether a contract is verified, so its edge cases are
 * the ones worth pinning down: the three things that legitimately differ
 * between compiled and deployed code (libraries, immutables, metadata) and
 * the difference that must never be forgiven (different code).
 *
 * Bytecode here is synthetic. Real fixtures would be thousands of hex
 * characters that hide exactly the byte the test is about.
 */

/** 32 bytes of metadata plus the two-byte length suffix Solidity appends. */
function metadataTrailer(fill = "ab"): string {
  return fill.repeat(32) + "0020";
}

const BODY = "6080604052348015600f57600080fd5b50";

function outputWith(contract: {
  deployed: string;
  immutableReferences?: Record<string, { start: number; length: number }[]>;
  linkReferences?: Record<string, Record<string, { start: number; length: number }[]>>;
}): SolcOutput {
  return {
    contracts: {
      "contracts/Token.sol": {
        Token: {
          abi: [{ type: "function", name: "transfer" }],
          metadata: '{"compiler":{"version":"0.8.24"}}',
          evm: {
            deployedBytecode: {
              object: contract.deployed,
              immutableReferences: contract.immutableReferences,
              linkReferences: contract.linkReferences,
            },
          },
        },
      },
    },
  };
}

describe("splitContractIdentifier", () => {
  it("splits on the last colon so Windows-ish paths survive", () => {
    expect(splitContractIdentifier("contracts/Token.sol:Token")).toEqual({
      file: "contracts/Token.sol",
      name: "Token",
    });
  });

  it("rejects identifiers that are not fully qualified", () => {
    expect(splitContractIdentifier("Token")).toBeNull();
    expect(splitContractIdentifier(":Token")).toBeNull();
    expect(splitContractIdentifier("contracts/Token.sol:")).toBeNull();
  });
});

describe("matchDeployedBytecode", () => {
  it("calls byte-identical code an exact match", () => {
    const deployed = BODY + metadataTrailer();
    const result = matchDeployedBytecode({
      output: outputWith({ deployed }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${deployed}`,
    });

    expect(result).toMatchObject({ matched: true, level: "exact_match" });
  });

  it("is case-insensitive about the on-chain hex and tolerates the 0x prefix", () => {
    const deployed = BODY + metadataTrailer();
    const result = matchDeployedBytecode({
      output: outputWith({ deployed }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: deployed.toUpperCase(),
    });

    expect(result).toMatchObject({ matched: true, level: "exact_match" });
  });

  it("downgrades to a partial match when only the metadata hash differs", () => {
    const compiled = BODY + metadataTrailer("ab");
    const onchain = BODY + metadataTrailer("cd");

    const result = matchDeployedBytecode({
      output: outputWith({ deployed: compiled }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${onchain}`,
    });

    // Same executable code, different comment or file path upstream.
    expect(result).toMatchObject({ matched: true, level: "match" });
  });

  it("ignores immutables, which the constructor writes after compilation", () => {
    // The compiler leaves an immutable slot zeroed; the chain has a value.
    const zeroed = "00".repeat(32);
    const value = "11".repeat(32);
    const compiled = BODY + zeroed + metadataTrailer();
    const onchain = BODY + value + metadataTrailer();

    const start = BODY.length / 2;
    const result = matchDeployedBytecode({
      output: outputWith({
        deployed: compiled,
        immutableReferences: { "42": [{ start, length: 32 }] },
      }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${onchain}`,
    });

    expect(result).toMatchObject({ matched: true, level: "exact_match" });
  });

  it("does not forgive a difference outside the immutable range", () => {
    const compiled = BODY + "00".repeat(32) + "dead" + metadataTrailer();
    const onchain = BODY + "11".repeat(32) + "beef" + metadataTrailer();

    const result = matchDeployedBytecode({
      output: outputWith({
        deployed: compiled,
        immutableReferences: { "42": [{ start: BODY.length / 2, length: 32 }] },
      }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${onchain}`,
    });

    expect(result).toMatchObject({ matched: false, code: "no_match" });
  });

  it("links library placeholders from settings.libraries", () => {
    // `__$` + 34 hex characters + `$__` occupies exactly the 20 bytes the
    // address will fill, which is what makes in-place substitution work.
    const placeholder = `__$${"1234567890abcdef1234567890abcdef12"}$__`;
    const library = "0x1111111111111111111111111111111111111111";
    const compiled = BODY + placeholder + metadataTrailer();
    const onchain = BODY + library.slice(2) + metadataTrailer();

    const result = matchDeployedBytecode({
      output: outputWith({
        deployed: compiled,
        linkReferences: {
          "contracts/Math.sol": { Math: [{ start: BODY.length / 2, length: 20 }] },
        },
      }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${onchain}`,
      libraries: { "contracts/Math.sol": { Math: library } },
    });

    expect(result).toMatchObject({ matched: true, level: "exact_match" });
  });

  it("asks for the address rather than reporting a mismatch when a library is unlinked", () => {
    const compiled = BODY + `__$${"1234567890abcdef1234567890abcdef12"}$__` + metadataTrailer();

    const result = matchDeployedBytecode({
      output: outputWith({
        deployed: compiled,
        linkReferences: {
          "contracts/Math.sol": { Math: [{ start: BODY.length / 2, length: 20 }] },
        },
      }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${compiled}`,
    });

    expect(result).toMatchObject({ matched: false, code: "unlinked_libraries" });
    if (!result.matched) expect(result.message).toContain("contracts/Math.sol:Math");
  });

  it("rejects genuinely different code", () => {
    const compiled = BODY + "aaaa" + metadataTrailer();
    const onchain = BODY + "bbbb" + metadataTrailer();

    const result = matchDeployedBytecode({
      output: outputWith({ deployed: compiled }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${onchain}`,
    });

    expect(result).toMatchObject({ matched: false, code: "no_match" });
    if (!result.matched) {
      // The caller needs both sides to explain the failure to a submitter.
      expect(result.recompiledRuntimeCode).toBe(`0x${compiled}`);
      expect(result.onchainRuntimeCode).toBe(`0x${onchain}`);
    }
  });

  it("rejects code of a different length before comparing anything", () => {
    const result = matchDeployedBytecode({
      output: outputWith({ deployed: BODY + metadataTrailer() }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${BODY}`,
    });

    expect(result).toMatchObject({ matched: false, code: "no_match" });
  });

  it("names what it did compile when the identifier is wrong", () => {
    const result = matchDeployedBytecode({
      output: outputWith({ deployed: BODY + metadataTrailer() }),
      identifier: "contracts/Token.sol:Toekn",
      onchainCode: `0x${BODY}${metadataTrailer()}`,
    });

    expect(result).toMatchObject({ matched: false, code: "contract_not_found" });
    if (!result.matched) expect(result.message).toContain("contracts/Token.sol:Token");
  });

  it("explains that an interface has nothing to verify", () => {
    const result = matchDeployedBytecode({
      output: outputWith({ deployed: "" }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${BODY}`,
    });

    expect(result).toMatchObject({ matched: false, code: "no_bytecode" });
  });

  it("returns the ABI on success, since that is what the explorer stores", () => {
    const deployed = BODY + metadataTrailer();
    const result = matchDeployedBytecode({
      output: outputWith({ deployed }),
      identifier: "contracts/Token.sol:Token",
      onchainCode: `0x${deployed}`,
    });

    if (!result.matched) throw new Error("expected a match");
    expect(result.abi).toEqual([{ type: "function", name: "transfer" }]);
    expect(result.metadata).toContain("0.8.24");
  });
});

describe("listCompiledContracts", () => {
  it("flattens the compiler's file/name nesting into identifiers", () => {
    expect(listCompiledContracts(outputWith({ deployed: BODY }))).toEqual([
      "contracts/Token.sol:Token",
    ]);
  });

  it("is empty rather than undefined when nothing compiled", () => {
    expect(listCompiledContracts({})).toEqual([]);
  });
});
