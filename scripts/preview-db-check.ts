import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRawUnsafe<{ migration_name: string; applied: boolean }[]>(
    `SELECT migration_name, finished_at IS NOT NULL AS applied
     FROM _prisma_migrations
     ORDER BY migration_name DESC LIMIT 8;`,
  );
  console.log('Recent migrations:');
  for (const m of migrations) console.log(`  ${m.applied ? '✓' : '✗'} ${m.migration_name}`);

  const counts = await prisma.$queryRawUnsafe<{ t: string; c: bigint }[]>(
    `SELECT 'User' AS t, COUNT(*)::bigint AS c FROM "User"
     UNION ALL SELECT 'Project', COUNT(*) FROM "Project"
     UNION ALL SELECT 'JobListing', COUNT(*) FROM "JobListing"
     UNION ALL SELECT 'Hackathon', COUNT(*) FROM "Hackathon";`,
  );
  console.log('\nRow counts:');
  for (const r of counts) console.log(`  ${r.t}: ${r.c}`);

  const cols = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema='public'
       AND ((table_name='Project' AND column_name='careers_rejected_at')
         OR (table_name='JobListing' AND column_name='rejected_at'));`,
  );
  console.log('\nRejection columns present:');
  for (const c of cols) console.log(`  ${c.table_name}.${c.column_name}`);
  if (cols.length === 0) console.log('  (none)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
