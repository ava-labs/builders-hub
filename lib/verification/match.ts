import type { LinkReferences, SolcContract, SolcOutput } from "./solc";

/* ------------------------------------------------------------------ */
/* Bytecode matching.                                                  */
/*                                                                     */
/* Verification is one comparison: does the code the compiler produced */
/* equal the code sitting on chain? Three things legitimately differ   */
/* and have to be normalised away first — library addresses that were  */
/* linked after compilation, immutable values written by the           */
/* constructor, and the metadata hash at the tail, which changes with  */
/* things as cosmetic as a comment.                                    */
/*                                                                     */
/* Surviving all three byte-for-byte is an exact match. Matching only  */
/* after the metadata is trimmed means the code is the same but the    */
/* sources may differ in ways the compiler ignored, which Sourcify     */
/* calls a (partial) match and so do we.                               */
/* ------------------------------------------------------------------ */

export type MatchLevel = "exact_match" | "match";

export type MatchFailureCode =
  | "contract_not_found"
  | "no_bytecode"
  | "unlinked_libraries"
  | "no_match";

export type MatchResult =
  | { matched: true; level: MatchLevel; abi: unknown[]; metadata: string | null }
  | {
      matched: false;
      code: MatchFailureCode;
      message: string;
      recompiledRuntimeCode?: string;
      onchainRuntimeCode?: string;
    };

/** `path/to/File.sol:ContractName`, as both tooling protocols spell it. */
export function splitContractIdentifier(identifier: string): { file: string; name: string } | null {
  const at = identifier.lastIndexOf(":");
  if (at <= 0 || at === identifier.length - 1) return null;
  return { file: identifier.slice(0, at), name: identifier.slice(at + 1) };
}

export function findContract(output: SolcOutput, identifier: string): SolcContract | null {
  const parts = splitContractIdentifier(identifier);
  if (!parts) return null;
  return output.contracts?.[parts.file]?.[parts.name] ?? null;
}

/** Every `file:Contract` the compiler produced, for pickers and errors. */
export function listCompiledContracts(output: SolcOutput): string[] {
  const found: string[] = [];
  for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
    for (const name of Object.keys(contracts)) found.push(`${file}:${name}`);
  }
  return found;
}

function stripPrefix(hex: string): string {
  return (hex.startsWith("0x") ? hex.slice(2) : hex).toLowerCase();
}

/**
 * Length in hex characters of the CBOR metadata trailer, or 0 when there
 * isn't a plausible one. Solidity writes the metadata length as the final
 * two bytes, so the trailer is that value plus the two length bytes.
 */
function metadataLength(hex: string): number {
  if (hex.length < 4) return 0;
  const declared = parseInt(hex.slice(-4), 16);
  if (!Number.isFinite(declared) || declared <= 0) return 0;
  const total = (declared + 2) * 2;
  return total <= hex.length ? total : 0;
}

function trimMetadata(hex: string): string {
  const length = metadataLength(hex);
  return length ? hex.slice(0, hex.length - length) : hex;
}

/** Overwrite byte ranges with zeroes so values written at deploy time stop
 *  being a difference. Offsets are byte offsets into the bytecode. */
function blankRanges(hex: string, ranges: { start: number; length: number }[]): string {
  if (!ranges.length) return hex;
  const chars = hex.split("");
  for (const { start, length } of ranges) {
    const from = start * 2;
    const to = from + length * 2;
    if (from < 0 || to > chars.length) continue;
    for (let i = from; i < to; i++) chars[i] = "0";
  }
  return chars.join("");
}

function immutableRanges(contract: SolcContract): { start: number; length: number }[] {
  const references = contract.evm?.deployedBytecode?.immutableReferences ?? {};
  return Object.values(references).flat();
}

/**
 * Substitute library addresses into placeholder slots. Returns null when
 * the input didn't supply an address for a library the code needs, which
 * is a submitter error rather than a mismatch.
 */
function linkLibraries(
  hex: string,
  linkReferences: LinkReferences | undefined,
  libraries: Record<string, Record<string, string>> | undefined,
): { linked: string } | { missing: string } {
  const entries = Object.entries(linkReferences ?? {});
  if (!entries.length) return { linked: hex };

  let out = hex;
  for (const [file, byName] of entries) {
    for (const [name, positions] of Object.entries(byName)) {
      const address =
        libraries?.[file]?.[name] ??
        libraries?.[`${file}:${name}`]?.[name] ??
        // Some tooling keys libraries by bare contract name.
        libraries?.[name]?.[name];
      if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return { missing: `${file}:${name}` };
      }
      const bare = stripPrefix(address);
      for (const { start, length } of positions) {
        if (length !== 20) continue;
        const from = start * 2;
        out = out.slice(0, from) + bare + out.slice(from + 40);
      }
    }
  }
  return { linked: out };
}

/**
 * Compare a compiled contract against deployed code.
 *
 * `onchainCode` is the result of eth_getCode. `libraries` is the standard
 * JSON input's `settings.libraries`, needed only when the contract links
 * against libraries that were not already linked at compile time.
 */
export function matchDeployedBytecode({
  output,
  identifier,
  onchainCode,
  libraries,
}: {
  output: SolcOutput;
  identifier: string;
  onchainCode: string;
  libraries?: Record<string, Record<string, string>>;
}): MatchResult {
  const contract = findContract(output, identifier);
  if (!contract) {
    const available = listCompiledContracts(output);
    return {
      matched: false,
      code: "contract_not_found",
      message:
        `The compiler output has no "${identifier}". ` +
        (available.length ? `It produced: ${available.slice(0, 20).join(", ")}.` : "It produced no contracts."),
    };
  }

  const compiledRaw = stripPrefix(contract.evm?.deployedBytecode?.object ?? "");
  if (!compiledRaw) {
    return {
      matched: false,
      code: "no_bytecode",
      message: `"${identifier}" compiles to no runtime bytecode. Interfaces and abstract contracts cannot be deployed or verified.`,
    };
  }

  const linkage = linkLibraries(
    compiledRaw,
    contract.evm?.deployedBytecode?.linkReferences,
    libraries,
  );
  if ("missing" in linkage) {
    return {
      matched: false,
      code: "unlinked_libraries",
      message: `No address supplied for library ${linkage.missing}. Add it under settings.libraries in the standard JSON input.`,
    };
  }

  const onchain = stripPrefix(onchainCode);
  const compiled = linkage.linked;
  const failure = (message: string): MatchResult => ({
    matched: false,
    code: "no_match",
    message,
    recompiledRuntimeCode: `0x${compiled}`,
    onchainRuntimeCode: `0x${onchain}`,
  });

  if (compiled.length !== onchain.length) {
    return failure("The compiled runtime bytecode is a different length than the deployed code.");
  }

  const ranges = immutableRanges(contract);
  const compiledBlanked = blankRanges(compiled, ranges);
  const onchainBlanked = blankRanges(onchain, ranges);

  if (compiledBlanked === onchainBlanked) {
    return {
      matched: true,
      level: "exact_match",
      abi: contract.abi ?? [],
      metadata: contract.metadata ?? null,
    };
  }

  if (trimMetadata(compiledBlanked) === trimMetadata(onchainBlanked)) {
    return {
      matched: true,
      level: "match",
      abi: contract.abi ?? [],
      metadata: contract.metadata ?? null,
    };
  }

  return failure("The deployed code does not match this source. Check the contract name, compiler version and settings.");
}
