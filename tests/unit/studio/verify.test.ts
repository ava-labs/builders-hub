import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keccak256 } from 'viem';

const { loadDeployment, viewOf, fileFindMany, compileSources, knownChain, findVerified, submitVerification } =
  vi.hoisted(() => ({
    loadDeployment: vi.fn(),
    viewOf: vi.fn(),
    fileFindMany: vi.fn(),
    compileSources: vi.fn(),
    knownChain: vi.fn(),
    findVerified: vi.fn(),
    submitVerification: vi.fn(),
  }));

vi.mock('@/server/services/studio/deployments', () => ({ loadDeployment, viewOf }));
vi.mock('@/prisma/prisma', () => ({ prisma: { studioFile: { findMany: fileFindMany } } }));
vi.mock('@/lib/studio/compile', () => ({ compileSources }));
vi.mock('@/lib/verification/chains', () => ({ knownChain }));
vi.mock('@/lib/verification/store', () => ({ findVerified, getJob: vi.fn() }));
vi.mock('@/lib/verification/service', () => ({ submitVerification }));

import { filesHash } from '@/server/services/studio/files';
import { standardJsonFor, startVerification, verificationStates } from '@/server/services/studio/verify';

const ADDRESS = '0x2222222222222222222222222222222222222222';
const BYTECODE = '0x6080604052' as const;
const FILES = [{ path: 'contracts/Guestbook.sol', content: 'contract Guestbook {}', sha256: 'aa' }];
const built = (over: Record<string, unknown> = {}) => ({
  stepId: 'deploy',
  contract: 'Guestbook',
  network: 'fuji-c-chain',
  chainId: 43113,
  address: ADDRESS,
  addressUrl: null,
  txHash: null,
  abi: [],
  source: 'build',
  file: 'contracts/Guestbook.sol',
  ...over,
});

function deployed(contracts: unknown[], filesHashOfBuild = filesHash(FILES)) {
  loadDeployment.mockResolvedValue({
    deployment: {
      project_id: 'proj-1',
      build: {
        files_hash: filesHashOfBuild,
        contracts: [{ file: 'contracts/Guestbook.sol', name: 'Guestbook', bytecodeHash: keccak256(BYTECODE) }],
      },
    },
  });
  viewOf.mockReturnValue({ deployed: contracts });
}

beforeEach(() => {
  vi.clearAllMocks();
  fileFindMany.mockResolvedValue(FILES);
  compileSources.mockResolvedValue({
    ok: true,
    compiler: '0.8.28+commit.7893614a',
    input: { language: 'Solidity', sources: {}, settings: {} },
    contracts: [{ file: 'contracts/Guestbook.sol', name: 'Guestbook', bytecode: BYTECODE }],
  });
  knownChain.mockReturnValue({ id: 43113 });
  findVerified.mockResolvedValue(null);
});

describe('verification states', () => {
  it('tells verified, unverified, published artifacts and chains the verifier does not cover apart', async () => {
    deployed([
      built(),
      built({ stepId: 'registry', contract: 'TeleporterRegistry', source: 'artifact', file: null }),
      built({ stepId: 'remote', chainId: 555001 }),
    ]);
    knownChain.mockImplementation((id: number) => (id === 43113 ? { id } : null));
    const states = await verificationStates('user-1', 'proj-1', 'dep-1');
    expect(states.map((s) => s.status)).toEqual(['unverified', 'artifact', 'unsupported']);
  });
});

describe('standardJsonFor', () => {
  it('rebuilds the exact input while the sources are the ones the deployment built', async () => {
    deployed([built()]);
    const result = await standardJsonFor('user-1', 'proj-1', 'dep-1', 'deploy');
    expect(result.contractIdentifier).toBe('contracts/Guestbook.sol:Guestbook');
    expect(result.compilerVersion).toBe('0.8.28+commit.7893614a');
    // Without immutableReferences the verifier can't blank constructor-set immutables, and never matches.
    const selection = (result.input.settings as { outputSelection: Record<string, Record<string, string[]>> })
      .outputSelection;
    expect(selection['*']['*']).toContain('evm.deployedBytecode.immutableReferences');
    expect(selection['*']['*']).toContain('metadata');
  });

  it('refuses when the contracts changed since the build', async () => {
    deployed([built()], 'another-hash');
    await expect(standardJsonFor('user-1', 'proj-1', 'dep-1', 'deploy')).rejects.toThrow('changed after');
    expect(compileSources).not.toHaveBeenCalled();
  });

  it('refuses when the rebuild does not reproduce the deployed bytecode', async () => {
    deployed([built()]);
    compileSources.mockResolvedValue({
      ok: true,
      compiler: 'x',
      input: {},
      contracts: [{ file: 'contracts/Guestbook.sol', name: 'Guestbook', bytecode: '0xdead' }],
    });
    await expect(standardJsonFor('user-1', 'proj-1', 'dep-1', 'deploy')).rejects.toThrow("didn't reproduce");
  });
});

describe('startVerification', () => {
  it('submits the rebuilt input to the Builder Hub verifier under the builder', async () => {
    deployed([built()]);
    submitVerification.mockResolvedValue({ ok: true, jobId: 'job-1', deduplicated: false, run: vi.fn() });
    const started = await startVerification('user-1', 'proj-1', 'dep-1', 'deploy');
    expect(started).toMatchObject({ status: 'submitted', jobId: 'job-1' });
    expect(submitVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 43113,
        address: ADDRESS,
        contractIdentifier: 'contracts/Guestbook.sol:Guestbook',
        clientId: 'studio:user-1',
      }),
    );
  });

  it('reports an already verified contract instead of resubmitting', async () => {
    deployed([built()]);
    findVerified.mockResolvedValue({ match: 'exact_match', verifiedAt: new Date() });
    expect(await startVerification('user-1', 'proj-1', 'dep-1', 'deploy')).toEqual({
      status: 'verified',
      match: 'exact_match',
    });
    expect(submitVerification).not.toHaveBeenCalled();
  });
});
