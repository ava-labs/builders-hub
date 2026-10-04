import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { syncIfChanged } from '@/utils/algolia-sync';

const body = Buffer.from(
  JSON.stringify([{ _id: '/docs/a', title: 'A', url: '/docs/a', structured: { headings: [], contents: [] } }]),
);
const hash = createHash('sha256').update(body).digest('hex');

function fakeClient(userData?: Record<string, unknown>, failRead = false) {
  return {
    getSettings: vi.fn(async () => {
      if (failRead) throw new Error('network');
      return { userData };
    }),
    setSettings: vi.fn(async () => ({ taskID: 1, updatedAt: '' })),
  };
}

describe('syncIfChanged', () => {
  it('syncs and stores the hash when the index has none', async () => {
    const client = fakeClient(undefined);
    const sync = vi.fn(async () => {});
    expect(await syncIfChanged({ client: client as never, body, indexName: 'i', sync })).toBe('synced');
    expect(sync).toHaveBeenCalledWith(client, { documents: JSON.parse(body.toString()), indexName: 'i' });
    expect(client.setSettings).toHaveBeenCalledWith({
      indexName: 'i',
      indexSettings: { userData: { recordsHash: hash } },
    });
  });

  it('skips the sync when the records match the stored hash', async () => {
    const client = fakeClient({ recordsHash: hash });
    const sync = vi.fn(async () => {});
    expect(await syncIfChanged({ client: client as never, body, indexName: 'i', sync })).toBe('skipped');
    expect(sync).not.toHaveBeenCalled();
    expect(client.setSettings).not.toHaveBeenCalled();
  });

  it('syncs when the records changed, and keeps the other userData keys', async () => {
    const client = fakeClient({ recordsHash: 'old', owner: 'docs' });
    const sync = vi.fn(async () => {});
    expect(await syncIfChanged({ client: client as never, body, indexName: 'i', sync })).toBe('synced');
    expect(sync).toHaveBeenCalledTimes(1);
    expect(client.setSettings).toHaveBeenCalledWith({
      indexName: 'i',
      indexSettings: { userData: { owner: 'docs', recordsHash: hash } },
    });
  });

  it('syncs when the settings cannot be read', async () => {
    const client = fakeClient(undefined, true);
    const sync = vi.fn(async () => {});
    expect(await syncIfChanged({ client: client as never, body, indexName: 'i', sync })).toBe('synced');
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('stores no hash when the sync fails, so the next build syncs again', async () => {
    const client = fakeClient({ recordsHash: 'old' });
    const sync = vi.fn(async () => {
      throw new Error('replace failed');
    });
    await expect(syncIfChanged({ client: client as never, body, indexName: 'i', sync })).rejects.toThrow(
      'replace failed',
    );
    expect(client.setSettings).not.toHaveBeenCalled();
  });
});
