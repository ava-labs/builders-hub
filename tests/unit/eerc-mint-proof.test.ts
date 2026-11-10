import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/eerc/proof', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eerc/proof')>('@/lib/eerc/proof');
  return {
    ...actual,
    generateProof: async (kind: string, input: Record<string, unknown>) => {
      const snarkjs: any = await import('snarkjs');
      const dir = path.join(process.cwd(), 'public/eerc/circuits', kind);
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        path.join(dir, `${kind}.wasm`),
        path.join(dir, `${kind}.zkey`),
      );
      return { points: actual.formatProofForSolidity(proof), publicSignals: publicSignals.map(BigInt), raw: proof };
    },
  };
});

import { BabyJub, FF, SNARK_FIELD_SIZE } from '@/lib/eerc/crypto';
import { formatKeyForCurve } from '@/lib/eerc/crypto/key';
import { privateMint } from '@/lib/eerc/operations/mint';

describe('privateMint inputs', () => {
  it('builds a witness the mint circuit accepts', async () => {
    const curve = new BabyJub(new FF(SNARK_FIELD_SIZE));
    const recipient = curve.generatePublicKey(formatKeyForCurve('1a2b3c4d5e6f'));
    const auditor = curve.generatePublicKey(formatKeyForCurve('0f0e0d0c0b0a'));
    let sent: { functionName: string; args: unknown[] } | null = null;
    await privateMint({
      encryptedERC: '0x0000000000000000000000000000000000000001',
      chainId: 43113,
      recipientAddress: '0x0000000000000000000000000000000000000002',
      recipientPublicKey: recipient,
      auditorPublicKey: auditor,
      amount: 10000n,
      writeContract: async (args) => {
        sent = args;
        return '0x01';
      },
    });
    expect(sent!.functionName).toBe('privateMint');
    expect((sent!.args[1] as { publicSignals: bigint[] }).publicSignals).toHaveLength(24);
  }, 120_000);
});
