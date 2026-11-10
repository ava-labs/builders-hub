import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Algoliasearch } from 'algoliasearch';
import type { DocumentRecord } from 'fumadocs-core/search/algolia';

type Sync = (client: Algoliasearch, options: { documents: DocumentRecord[]; indexName: string }) => Promise<void>;

/**
 * Finds the body of the prerendered /static.json route (the search records) in a next build.
 *
 * A build with no adapter writes it to server/app/static.json.body. From next 16.3.8, a build
 * with an adapter (every Vercel build) writes it to
 * server/route-cache/APP_ROUTE/<hash of the route>/$/static.json.body instead.
 */
export function findStaticJsonBody(distDir = '.next'): string {
  const appFile = join(distDir, 'server', 'app', 'static.json.body');
  if (existsSync(appFile)) return appFile;

  const routeCache = join(distDir, 'server', 'route-cache', 'APP_ROUTE');
  const found = existsSync(routeCache)
    ? readdirSync(routeCache)
        .map((key) => join(routeCache, key, '$', 'static.json.body'))
        .filter((file) => existsSync(file))
    : [];
  if (found.length !== 1) {
    throw new Error(`Expected one static.json.body in ${appFile} or ${routeCache}, found ${found.length}`);
  }
  return found[0];
}

/**
 * Writes the search records to the Algolia index, unless they match the last sync.
 *
 * sync() of fumadocs replaces every object in the index, which takes about 16 s of each
 * production build. The SHA-256 of static.json.body is kept in the index settings
 * (userData.recordsHash). Algolia keeps the settings when it replaces the objects, so the
 * hash describes the live index whoever ran the last sync. A failed settings read means a
 * full sync.
 */
export async function syncIfChanged({
  client,
  body,
  indexName,
  sync,
}: {
  client: Pick<Algoliasearch, 'getSettings' | 'setSettings'>;
  body: Buffer;
  indexName: string;
  sync: Sync;
}): Promise<'skipped' | 'synced'> {
  const recordsHash = createHash('sha256').update(body).digest('hex');
  const settings = await client.getSettings({ indexName }).catch(() => undefined);
  const userData = settings?.userData ?? {};
  if (userData.recordsHash === recordsHash) return 'skipped';

  await sync(client as Algoliasearch, { documents: JSON.parse(body.toString()), indexName });
  await client.setSettings({ indexName, indexSettings: { userData: { ...userData, recordsHash } } });
  return 'synced';
}
