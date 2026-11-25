import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* POST /api/project writes a project from the body. Each field it writes has the type of its column, so a body
   cannot put an object where a column holds text or a list. The bodies below are the ones the four forms send. */

const createProject = vi.hoisted(() => vi.fn());

vi.mock('@/server/services/submitProject', () => ({ createProject }));
vi.mock('@/server/services/projects', () => ({ GetProjectByHackathonAndUser: vi.fn() }));
vi.mock('@/prisma/prisma', () => ({ prisma: { registerForm: { findUnique: vi.fn(async () => ({ id: 'reg-1' })) } } }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => ({ user: { id: 'me', email: 'me@example.com' } }) }));

import { POST } from '@/app/api/project/route';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/project', { method: 'POST', body: JSON.stringify(body) }), {});

beforeEach(() => {
  createProject.mockReset().mockResolvedValue({ id: 'project-1', members: [] });
});

describe('POST /api/project', () => {
  it('refuses an object or a wrong type in a field it writes, before any write', async () => {
    const bad = [
      { project_name: { set: 'x' } },
      { short_description: ['a'] },
      { tracks: { push: 'x' } },
      { screenshots: { set: [] } },
      { screenshots: [1, 2] },
      { is_preexisting_idea: 'yes' },
      { other_category: { set: null } },
      { id: { not: '' } },
      { hackaton_id: ['a'] },
      { isDraft: 'true' },
    ];
    for (const body of bad) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect(createProject).not.toHaveBeenCalled();
  });

  it('saves the body of the hackathon submission form', async () => {
    const res = await post({
      project_name: 'P', short_description: 'S', full_description: 'F', tech_stack: 'T', tech_stack_tags: ['solidity'],
      github_repository: 'https://github.com/a/b,https://github.com/a/c', demo_link: '', demo_video_link: '', explanation: '',
      is_preexisting_idea: false, tracks: ['defi'], categories: 'DeFi,Gaming', other_category: null,
      deployed_addresses: [{ address: '0xabc', tag: 'main' }], website: { link_1: 'https://a.example' }, socials: null,
      logo_url: '', cover_url: '', screenshots: ['https://img.example/1.png'], logoFile: {}, coverFile: null,
      is_winner: false, hackaton_id: 'event-1', user_id: 'someone-else', id: undefined,
    });
    expect(res.status).toBe(201);
    const sent = createProject.mock.calls[0][0];
    // the session names the writer, whatever the body says
    expect(sent.user_id).toBe('me');
    expect(sent.submittedBy).toBe('me@example.com');
    expect(sent.categories).toEqual(['DeFi', 'Gaming']);
    expect(sent.deployed_addresses).toEqual([{ address: '0xabc', tag: 'main' }]);
  });

  it('saves the bodies of the Build Games draft and the mini-grant project', async () => {
    const draft = await post({
      project_name: '', short_description: '', full_description: '', tech_stack: '', github_repository: '', demo_link: '',
      demo_video_link: '', tracks: [], categories: [], other_category: '', is_preexisting_idea: false, hackaton_id: 'event-1',
      user_id: 'me', is_winner: false, id: null, logo_url: '', cover_url: '', screenshots: [], isDraft: true,
    });
    expect(draft.status).toBe(201);
    const grant = await post({
      project_name: 'P', short_description: 'S', categories: ['Other'], other_category: 'Tools', is_preexisting_idea: true,
      origin: 'mini-grant', website: { url: 'https://a.example' }, socials: { X: 'a', GitHub: 'b' },
    });
    expect(grant.status).toBe(201);
  });

  it('reads a wrong shape as absent where the service already reads it as empty', async () => {
    const res = await post({ project_name: 'P', short_description: 'S', tech_stack_tags: 'solidity', categories: 7, website: [], socials: 'x', consent_sharing: 'yes' });
    expect(res.status).toBe(201);
    const sent = createProject.mock.calls[0][0];
    for (const field of ['tech_stack_tags', 'categories', 'website', 'socials', 'consent_sharing']) expect(sent[field], field).toBeUndefined();
  });
});
