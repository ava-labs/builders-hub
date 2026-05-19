// Dry-run the Ecosystem Careers scraper without touching the DB. Useful for
// verifying the Getro SSR shape hasn't changed.
//
// Usage:  npx tsx scripts/scrape-ecosystem-jobs-dry-run.ts

import { scrapeGetroJobs } from '../server/services/ecosystemCareers/scrapeGetro';

async function main() {
  console.log('Scraping jobs.avax.network …');
  const t0 = Date.now();
  const result = await scrapeGetroJobs({ concurrency: 4 });
  const dt = Date.now() - t0;

  console.log('---');
  console.log(`companies: ${result.companies.length}`);
  console.log(`jobs: ${result.jobs.length} (out of ${result.total} total reported)`);
  console.log(`took: ${dt}ms`);
  console.log('---');
  console.log('sample company:', JSON.stringify(result.companies[0], null, 2));
  console.log('sample job:');
  if (result.jobs[0]) {
    const j = result.jobs[0];
    console.log({
      ...j,
      description: j.description ? `${j.description.slice(0, 120)}…` : null,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
