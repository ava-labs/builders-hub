// One-off CLI smoke test for the ecosystem-careers ingest pipeline.
//
// Usage (from the worktree root):
//   npx tsx scripts/test-careers-ingest.mts [--write]
//
// Loads env vars from the closest .env walking up from cwd, falling back
// to ~/builders-hub/.env so it works whether you run from a worktree or
// from the main repo. Default mode is dry-run.

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../../.env'),
  resolve(process.env.HOME ?? '', 'builders-hub/.env'),
];
for (const path of candidates) {
  if (existsSync(path)) {
    loadEnv({ path });
    console.log(`Loaded env from ${path}`);
    break;
  }
}

const { fetchGetroDryRun, ingestGetro } = await import(
  '../server/services/ecosystemCareers/ingestGetro'
);
const { fetchWeb3CareerDryRun, ingestWeb3Career } = await import(
  '../server/services/ecosystemCareers/ingestWeb3Career'
);

const WRITE = process.argv.includes('--write');

function divider(label: string) {
  const bar = '─'.repeat(Math.max(0, 60 - label.length - 2));
  return `\n── ${label} ${bar}`;
}

function mapGetro(j: Record<string, unknown>) {
  const company = (j.company ?? null) as Record<string, unknown> | null;
  const workMode = j.work_mode as string | null | undefined;
  const remoteType = workMode === 'remote' ? 'remote' : workMode === 'on_site' ? 'onsite' : null;
  return {
    source: 'getro',
    external_id: String(j.id ?? ''),
    title: j.title,
    company_name: company?.name ?? null,
    company_logo: company?.logo_url ?? null,
    location: (j.locations as string[] | undefined)?.filter(Boolean).join(' · ') || null,
    remote_type: remoteType,
    seniority: j.seniority ?? null,
    tags: (j.job_functions as string[] | undefined) ?? [],
    apply_url: j.url,
    posted_at: j.created_at,
    is_active: false,
  };
}

function mapW3C(j: Record<string, unknown>) {
  const city = j.city as string | undefined;
  const country = j.country as string | undefined;
  const location =
    [city?.trim(), country?.trim()].filter(Boolean).join(', ') ||
    (j.location as string | undefined)?.trim() ||
    null;
  const epoch = j.date_epoch as number | undefined;
  const date = j.date as string | undefined;
  const posted = typeof epoch === 'number' ? new Date(epoch * 1000) : date ? new Date(date) : null;
  return {
    source: 'external',
    external_id: String(j.id ?? ''),
    title: j.title,
    company_name: j.company ?? null,
    location,
    remote_type: j.is_remote ? 'remote' : null,
    tags: ((j.tags as string[] | undefined) ?? []).slice(0, 10),
    apply_url: j.apply_url,
    posted_at: posted?.toISOString() ?? null,
    is_active: false,
  };
}

(async () => {
  console.log(`Mode: ${WRITE ? 'WRITE (will insert rows)' : 'DRY-RUN (no DB writes)'}`);
  console.log(`DATABASE_URL host: ${process.env.DATABASE_URL?.match(/@([^/]+)/)?.[1] ?? '(unset)'}`);

  console.log(divider('Getro · api.getro.com/v2/networks/10223/jobs'));
  if (!process.env.GETRO_CAREER_API_KEY) {
    console.log('  GETRO_CAREER_API_KEY missing — skipping');
  } else if (WRITE) {
    const r = await ingestGetro({ includeDescriptions: true });
    console.log('  inserted:', r.inserted, '· updated:', r.updated, '· skipped:', r.skipped);
    console.log('  pagesFetched:', r.pagesFetched);
    if (r.error) console.log('  ERROR:', r.error);
  } else {
    const r = await fetchGetroDryRun({ includeDescriptions: false });
    console.log('  pagesFetched:', r.pagesFetched, '· fetched:', r.fetched, '· after age filter:', r.afterAgeFilter);
    if (r.error) console.log('  ERROR:', r.error);
    if (r.sample[0]) {
      console.log('  First row mapped to JobListing:');
      console.log('  ' + JSON.stringify(mapGetro(r.sample[0] as Record<string, unknown>), null, 2).split('\n').join('\n  '));
    }
  }

  console.log(divider('web3.career · web3.career/api/v1 (multi-tag fan-out)'));
  if (!process.env.WEB3_CAREER_API_KEY) {
    console.log('  WEB3_CAREER_API_KEY missing — skipping');
  } else if (WRITE) {
    const r = await ingestWeb3Career();
    console.log('  inserted:', r.inserted, '· updated:', r.updated, '· skipped:', r.skipped);
    console.log('  queriesRun:', r.queriesRun);
    if (r.error) console.log('  ERROR:', r.error);
  } else {
    const r = await fetchWeb3CareerDryRun();
    console.log(
      '  queriesRun:', r.queriesRun,
      '· total returned:', r.fetched,
      '· unique ids:', r.uniqueIds,
      '· after age filter:', r.afterAgeFilter,
    );
    if (r.error) console.log('  ERROR:', r.error);
    if (r.sample[0]) {
      console.log('  First row mapped to JobListing:');
      console.log('  ' + JSON.stringify(mapW3C(r.sample[0] as Record<string, unknown>), null, 2).split('\n').join('\n  '));
    }
  }

  console.log(divider('Done'));
  process.exit(0);
})().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
