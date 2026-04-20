// Client-side Groth16 proof generation using snarkjs + the circuit artifacts
// hosted under /eerc/circuits/. Runs on the main thread for now — the
// registration circuit is small (ptau 11, ~2MB zkey) and proves in under a
// few seconds. Transfer / mint / burn circuits are ptau 15 and should later
// move to a Web Worker, but the interface below is already async so we can
// swap the implementation without rippling changes.

import * as snarkjs from 'snarkjs';
import type { CircuitKind, ProofPoints } from './types';
import type { BJPoint } from './crypto/babyjub';

/** URL helpers — circuits live at /eerc/circuits/<kind>/<kind>.{wasm,zkey}. */
export function circuitWasmUrl(kind: CircuitKind): string {
  return `/eerc/circuits/${kind}/${kind}.wasm`;
}
export function circuitZkeyUrl(kind: CircuitKind): string {
  return `/eerc/circuits/${kind}/${kind}.zkey`;
}

/** Raw snarkjs output — we format it into the Solidity struct shape below. */
export interface RawProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface GeneratedProof {
  points: ProofPoints;
  publicSignals: bigint[];
  /** The raw snarkjs output, useful for debugging and teaching. */
  raw: RawProof;
}

/**
 * Generate a Groth16 proof for the given circuit + witness input.
 * `input` keys must match the circuit's signal names exactly (case-sensitive).
 */
export async function generateProof(
  kind: CircuitKind,
  input: Record<string, unknown>,
): Promise<GeneratedProof> {
  const wasmUrl = circuitWasmUrl(kind);
  const zkeyUrl = circuitZkeyUrl(kind);

  // snarkjs accepts URL strings in browser environments — it fetches the
  // artifacts lazily. The first call per circuit is slow (artifact download
  // + compile); subsequent calls hit the HTTP cache.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(input, wasmUrl, zkeyUrl);

  return {
    points: formatProofForSolidity(proof),
    publicSignals: publicSignals.map((s: string) => BigInt(s)),
    raw: proof,
  };
}

/**
 * Convert snarkjs's proof shape to the `ProofPoints` struct layout expected
 * by the Solidity verifiers. The critical detail is the Fp2 pair swap in
 * the `b` matrix — solc's pairing precompile wants imaginary-part-first.
 */
export function formatProofForSolidity(proof: RawProof): ProofPoints {
  return {
    a: [BigInt(proof.pi_a[0] as string), BigInt(proof.pi_a[1] as string)],
    b: [
      [BigInt(proof.pi_b[0]![1] as string), BigInt(proof.pi_b[0]![0] as string)],
      [BigInt(proof.pi_b[1]![1] as string), BigInt(proof.pi_b[1]![0] as string)],
    ],
    c: [BigInt(proof.pi_c[0] as string), BigInt(proof.pi_c[1] as string)],
  };
}

/**
 * Convert a tuple-form curve point `[x, y]` (used throughout crypto math)
 * to the struct form `{ x, y }` that contract ABIs encode.
 */
export function pointToStruct(p: BJPoint): { x: bigint; y: bigint } {
  return { x: p[0], y: p[1] };
}
