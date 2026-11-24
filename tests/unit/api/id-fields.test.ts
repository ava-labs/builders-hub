import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* An ID in a JSON body is text. Prisma reads an object in its place as a filter, so a handler that checks ownership
   with the field and then reuses the field reads or writes rows the caller does not own. */

const db = vi.hoisted(() => ({
  conversationFindFirst: vi.fn(),
  conversationUpdate: vi.fn(),
  messageDeleteMany: vi.fn(),
  projectFindFirst: vi.fn(),
  formFindFirst: vi.fn(),
  formUpdate: vi.fn(),
  formCreate: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => {
  const formData = { findFirst: db.formFindFirst, update: db.formUpdate, create: db.formCreate };
  return {
    prisma: {
      chatConversation: { findFirst: db.conversationFindFirst, update: db.conversationUpdate },
      chatMessage: { deleteMany: db.messageDeleteMany },
      project: { findFirst: db.projectFindFirst },
      formData,
      $transaction: (run: (tx: unknown) => unknown) => run({ formData }),
    },
  };
});

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => ({ user: { id: 'user-1' } }) }));

import { POST as saveChat } from '@/app/api/chat-history/route';
import { POST as saveStage } from '@/app/api/build-games/stage-data/route';

const post = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body) });
const MESSAGES = [{ role: 'user', content: 'hello' }];

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('POST /api/chat-history', () => {
  it('refuses an id that is not text, before any query', async () => {
    for (const id of [{ not: '' }, { contains: '' }, ['a'], 7, true]) {
      const res = await saveChat(post('/api/chat-history', { id, title: 't', messages: MESSAGES }));
      expect(res.status).toBe(400);
    }
    expect(db.conversationFindFirst).not.toHaveBeenCalled();
    expect(db.messageDeleteMany).not.toHaveBeenCalled();
  });

  it('refuses a title that is not text', async () => {
    const res = await saveChat(post('/api/chat-history', { title: { set: 'x' }, messages: MESSAGES }));
    expect(res.status).toBe(400);
  });

  it("writes with the id of the caller's own row", async () => {
    db.conversationFindFirst.mockResolvedValue({ id: 'conv-1', user_id: 'user-1' });
    db.conversationUpdate.mockResolvedValue({ id: 'conv-1' });
    const res = await saveChat(post('/api/chat-history', { id: 'conv-1', title: 't', messages: MESSAGES }));
    expect(res.status).toBe(200);
    expect(db.conversationFindFirst).toHaveBeenCalledWith({ where: { id: 'conv-1', user_id: 'user-1' } });
    expect(db.messageDeleteMany).toHaveBeenCalledWith({ where: { conversation_id: 'conv-1' } });
    expect(db.conversationUpdate.mock.calls[0][0].where).toEqual({ id: 'conv-1' });
  });
});

describe('POST /api/build-games/stage-data', () => {
  const ctx = undefined as never;

  it('refuses a project_id that is not text, before any query', async () => {
    for (const project_id of [{ not: '' }, { gt: 'a' }, ['a'], 7]) {
      const res = await saveStage(post('/api/build-games/stage-data', { project_id, form_data: { build_games: { a: 1 } } }), ctx);
      expect(res.status).toBe(400);
    }
    expect(db.projectFindFirst).not.toHaveBeenCalled();
    expect(db.formFindFirst).not.toHaveBeenCalled();
  });

  it("reads and writes the form of the caller's own project", async () => {
    db.projectFindFirst.mockResolvedValue({ id: 'project-1' });
    db.formFindFirst.mockResolvedValue(null);
    db.formCreate.mockResolvedValue({ form_data: { build_games: { a: 1 } } });
    const res = await saveStage(post('/api/build-games/stage-data', { project_id: 'project-1', form_data: { build_games: { a: 1 } } }), ctx);
    expect(res.status).toBe(200);
    expect(db.formFindFirst).toHaveBeenCalledWith({ where: { project_id: 'project-1', origin: 'build_games' } });
    expect(db.formCreate.mock.calls[0][0].data.project_id).toBe('project-1');
  });
});
