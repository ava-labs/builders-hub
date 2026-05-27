import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { ingestGetro } from '@/server/services/ecosystemCareers/ingestGetro';
import { ingestWeb3Career } from '@/server/services/ecosystemCareers/ingestWeb3Career';
import { postSlackDigest } from '@/server/services/ecosystemCareers/slackDigest';

// Weekly Vercel Cron: pull fresh roles from Getro + web3.career and ping the
// DevRel review queue on Slack. Vercel Cron invokes the path with a GET
// request and the platform CRON_SECRET in the Authorization header. POST is
// kept open for manual triggering (curl from a maintainer's laptop) using the
// same secret.
async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const isCron =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Sequence matters: ingestWeb3Career reads the distinct Getro company
  // names to build its Avalanche allow-list, so Getro must finish first.
  const getroResult = await ingestGetro();
  const web3careerResult = await ingestWeb3Career();

  const [projectsPending, externalPending, getroPending] = await Promise.all([
    prisma.project.count({
      where: {
        careers_approved: false,
        jobListings: { some: { source: 'community', is_active: false } },
      },
    }),
    prisma.jobListing.count({ where: { source: 'external', is_active: false } }),
    prisma.jobListing.count({ where: { source: 'getro', is_active: false } }),
  ]);

  const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://build.avax.network'}/admin/ecosystem-careers`;
  const slackError = await postSlackDigest({
    projectsPending,
    externalListingsPending: externalPending,
    getroListingsPending: getroPending,
    ingest: { getro: getroResult, web3career: web3careerResult },
    reviewUrl,
  });

  return NextResponse.json({
    ok: true,
    ingest: { getro: getroResult, web3career: web3careerResult },
    pending: {
      projects: projectsPending,
      externalListings: externalPending,
      getroListings: getroPending,
    },
    slackError,
  });
}

export const GET = handle;
export const POST = handle;
