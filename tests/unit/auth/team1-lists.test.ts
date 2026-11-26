import { describe, expect, it } from 'vitest';
import { withoutTeam1 } from '@/lib/auth/normalize-path';

/* The text exports, the search index and the MCP tools answer with no session, so the Team1 Academy's pages, which
   need a role on the site, are not in the list they read (publicAcademyPages in lib/source.ts). */

describe('withoutTeam1', () => {
  it('drops the Team1 pages and keeps the others', () => {
    const pages = [
      { slugs: ['avalanche-fundamentals', 'intro'] },
      { slugs: ['team1', 'team1-fundamentals'] },
      { slugs: ['team1'] },
      { slugs: ['TEAM1', 'course'] },
      { slugs: ['team1/course'] },
      { slugs: ['team10', 'course'] },
    ];
    expect(withoutTeam1(pages).map((p) => p.slugs.join('/'))).toEqual(['avalanche-fundamentals/intro', 'team10/course']);
  });
});
