// Ambient module declarations for Encrypted ERC dependencies that ship
// without first-party TypeScript types. We only declare the subset we use.

declare module 'blake-hash' {
  interface BlakeHash {
    update(data: Buffer | Uint8Array): BlakeHash;
    digest(): Buffer;
  }
  function createBlakeHash(algorithm: 'blake256' | 'blake512'): BlakeHash;
  export = createBlakeHash;
}

declare module 'snarkjs' {
  export namespace groth16 {
    function fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{
      proof: {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
        protocol: string;
        curve: string;
      };
      publicSignals: string[];
    }>;

    function verify(
      vKey: unknown,
      publicSignals: string[],
      proof: unknown,
    ): Promise<boolean>;
  }
}
