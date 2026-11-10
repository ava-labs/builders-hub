import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findStaticJsonBody, syncIfChanged } from '@/utils/algolia-sync';

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

describe('findStaticJsonBody', () => {
  let distDir = '';
  afterEach(() => rmSync(distDir, { recursive: true, force: true }));

  function write(...parts: string[]) {
    mkdirSync(join(distDir, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(distDir, ...parts), '[]');
    return join(distDir, ...parts);
  }

  it('finds the body that a build with no adapter writes to server/app', () => {
    distDir = mkdtempSync(join(tmpdir(), 'next-'));
    const file = write('server', 'app', 'static.json.body');
    expect(findStaticJsonBody(distDir)).toBe(file);
  });

  it('finds the body that an adapter build of next 16.3.8 writes to the route cache', () => {
    distDir = mkdtempSync(join(tmpdir(), 'next-'));
    write('server', 'route-cache', 'APP_ROUTE', 'aaa', '$', 'llms.txt.body');
    const file = write('server', 'route-cache', 'APP_ROUTE', 'ff714dfd', '$', 'static.json.body');
    expect(findStaticJsonBody(distDir)).toBe(file);
  });

  it('throws when the build has no static.json body', () => {
    distDir = mkdtempSync(join(tmpdir(), 'next-'));
    write('server', 'route-cache', 'APP_ROUTE', 'aaa', '$', 'llms.txt.body');
    expect(() => findStaticJsonBody(distDir)).toThrow('found 0');
  });
});
