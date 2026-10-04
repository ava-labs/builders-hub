import { createHash } from 'node:crypto';
import type { Algoliasearch } from 'algoliasearch';
import type { DocumentRecord } from 'fumadocs-core/search/algolia';

type Sync = (client: Algoliasearch, options: { documents: DocumentRecord[]; indexName: string }) => Promise<void>;

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
