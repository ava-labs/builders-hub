import { blog, integration } from '@/lib/source';
import { integrationCategoryCount, listedIntegrations } from '@/lib/integrations/listed';
import { getFilteredHackathons } from '@/server/services/hackathons';
import { countActiveFirms } from '@/server/services/audits/visibility';

/**
 * The live figures of the /ecosystem overview. Each one comes from the same
 * read its own page makes, so the overview never states a number its page
 * does not. A figure whose source is unreachable (no database in local dev,
 * a failed query) is null, and the overview leaves it out.
 */
export type EcosystemFigures = {
  events: {
    upcoming: number;
    ongoing: number;
    /** the soonest upcoming public event */
    next: { title: string; startDate: string; timezone: string } | null;
  } | null;
  /** active firms on the audit whitelist, the /audits landing figure */
  auditFirms: number | null;
  latestPost: { title: string; date: string } | null;
  integrations: { count: number; categories: number } | null;
};

async function eventFigures(): Promise<EcosystemFigures['events']> {
  try {
    const [upcoming, ongoing] = await Promise.all([
      getFilteredHackathons({ status: 'UPCOMING', pageSize: 1, sort: 'start_date_asc' }),
      getFilteredHackathons({ status: 'ONGOING', pageSize: 1 }),
    ]);
    const next = upcoming.hackathons[0];
    return {
      upcoming: upcoming.total,
      ongoing: ongoing.total,
      // start_date is typed string but holds the Prisma Date: normalize it to ISO
      next: next
        ? { title: next.title, startDate: new Date(next.start_date).toISOString(), timezone: next.timezone }
        : null,
    };
  } catch (error) {
    console.warn('ecosystem: event figures unavailable', error);
    return null;
  }
}

async function auditFirmCount(): Promise<number | null> {
  try {
    return await countActiveFirms();
  } catch (error) {
    console.warn('ecosystem: audit firm count unavailable', error);
    return null;
  }
}

/** The newest post, in the order the blog list sorts it. */
function latestPost(): EcosystemFigures['latestPost'] {
  const dated = blog
    .getPages()
    .filter((page) => page.data.date)
    .map((page) => ({ title: page.data.title, date: new Date(page.data.date as string | Date) }))
    .filter((post) => !Number.isNaN(post.date.getTime()))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const newest = dated[0];
  return newest ? { title: newest.title, date: newest.date.toISOString() } : null;
}

function integrationFigures(): EcosystemFigures['integrations'] {
  const listed = listedIntegrations(integration.getPages());
  if (listed.length === 0) return null;
  return { count: listed.length, categories: integrationCategoryCount(listed) };
}

export async function getEcosystemFigures(): Promise<EcosystemFigures> {
  const [events, auditFirms] = await Promise.all([eventFigures(), auditFirmCount()]);
  return { events, auditFirms, latestPost: latestPost(), integrations: integrationFigures() };
}
