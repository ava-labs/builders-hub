import { beforeEach, describe, expect, it, vi } from 'vitest';

/* What a builder can make the server spend has a limit that the builder cannot clear: each call to the model and each
   compile is counted on its own, a compile takes one of the compiler's slots, and a project's parameters and its file
   paths, which go to the model on each step, have a size. */

const { consumeQuota, acquireCompileSlot, compileSources, prisma } = vi.hoisted(() => ({
  consumeQuota: vi.fn(),
  acquireCompileSlot: vi.fn(),
  compileSources: vi.fn(),
  prisma: {
    studioMessage: { count: vi.fn(), findMany: vi.fn() },
    studioProject: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/verification/limits', () => ({ consumeQuota, acquireCompileSlot }));
vi.mock('@/lib/studio/compile', () => ({ compileSources }));
vi.mock('@/prisma/prisma', () => ({ prisma }));
vi.mock('@/lib/blueprints', () => ({ listBlueprintIds: () => [], loadBlueprint: vi.fn() }));

import { compileForBuilder } from '@/server/services/studio/compile-limit';
import { readFile } from '@/server/services/studio/files';
import { updateProject } from '@/server/services/studio/projects';
import { assertChatQuota } from '@/server/services/studio/quota';
import { planImport } from '@/lib/studio/import';
import { MAX_STUDIO_PARAMS_CHARS, MAX_STUDIO_PATH_CHARS } from '@/types/studio';

const status = async (run: Promise<unknown>) => run.then(() => 200, (error: { status?: number }) => error.status);
const PROJECT = { id: 'proj-1', user_id: 'me', blueprint_ids: [], networks: {}, params: { a: 'x' } };

beforeEach(() => {
  vi.clearAllMocks();
  consumeQuota.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 });
  prisma.studioMessage.count.mockResolvedValue(0);
  prisma.studioMessage.findMany.mockResolvedValue([]);
  prisma.studioProject.findFirst.mockResolvedValue(PROJECT);
  prisma.studioProject.update.mockImplementation((args: unknown) => args);
});

describe('the chat quota', () => {
  it('counts each call, so a builder with no stored message is refused after the hourly limit', async () => {
    expect(await status(assertChatQuota('me'))).toBe(200);
    expect(consumeQuota).toHaveBeenCalledWith('studio-chat:me', { limit: 40, windowMs: 3_600_000 });
    consumeQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    expect(await status(assertChatQuota('me'))).toBe(429);
  });

  it('still refuses on the stored messages, before it counts a call', async () => {
    prisma.studioMessage.count.mockResolvedValue(40);
    expect(await status(assertChatQuota('me'))).toBe(429);
    expect(consumeQuota).not.toHaveBeenCalled();
  });
});

describe('a Studio compile', () => {
  const release = vi.fn();

  it('runs in a compiler slot and gives it back, also when the compile throws', async () => {
    acquireCompileSlot.mockResolvedValue({ release });
    compileSources.mockResolvedValueOnce({ ok: true });
    expect(await compileForBuilder('me', { 'contracts/A.sol': '' })).toEqual({ ok: true });
    expect(consumeQuota).toHaveBeenCalledWith('studio-compile:me', { limit: 30, windowMs: 600_000 });
    compileSources.mockRejectedValueOnce(new Error('boom'));
    await expect(compileForBuilder('me', {})).rejects.toThrow('boom');
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('is refused past the builder quota, with no slot taken and no compile', async () => {
    consumeQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    expect(await status(compileForBuilder('me', {}))).toBe(429);
    expect(acquireCompileSlot).not.toHaveBeenCalled();
    expect(compileSources).not.toHaveBeenCalled();
  });

  it('answers 503 when no slot comes free', async () => {
    vi.useFakeTimers();
    acquireCompileSlot.mockResolvedValue(null);
    const run = status(compileForBuilder('me', {}));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await run).toBe(503);
    expect(compileSources).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('sizes that go to the model', () => {
  it('refuses parameters past the cap, counted with the keys the project already has', async () => {
    expect(await status(updateProject('me', 'proj-1', { params: { b: 'y' } }))).toBe(200);
    expect(prisma.studioProject.update.mock.calls[0][0].data.params).toEqual({ a: 'x', b: 'y' });
    expect(await status(updateProject('me', 'proj-1', { params: { b: 'y'.repeat(MAX_STUDIO_PARAMS_CHARS) } }))).toBe(400);
    expect(prisma.studioProject.update).toHaveBeenCalledTimes(1);
  });

  it('refuses a path past the cap, on a read and in an import', async () => {
    const long = `contracts/${'a'.repeat(MAX_STUDIO_PATH_CHARS)}.sol`;
    expect(await status(readFile('me', 'proj-1', long))).toBe(400);
    const plan = planImport([
      { path: `src/${'a'.repeat(MAX_STUDIO_PATH_CHARS)}.sol`, content: 'contract A {}' },
      { path: 'src/Token.sol', content: 'contract Token {}' },
    ]);
    expect(plan.skipped.map((f) => f.reason)).toEqual(['folder or file name Studio cannot store']);
    expect(plan.files.map((f) => f.path)).toEqual(['contracts/Token.sol']);
  });
});
