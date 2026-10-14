import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));

import type { ProjectOverview } from '@/components/studio/api';
import { attentionMarks } from '@/components/studio/StudioWorkspace';

const MESSENGER = '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf';

function overview(project: Record<string, unknown> = {}, deployments: { status: string }[] = []) {
  return {
    project: {
      blueprint_ids: ['icm-messenger'],
      networks: { source: 'fuji-c-chain', destination: 'l1' },
      runtime: {},
      ...project,
    },
    deployments,
  } as unknown as ProjectOverview;
}

describe('attentionMarks', () => {
  it('marks nothing when every tab is settled', () => {
    const l1 = {
      name: 'Moon',
      teleporter: { messenger: MESSENGER, registry: '0x4444444444444444444444444444444444444444' },
    };
    expect(attentionMarks(overview({ runtime: { testnet: { l1 } } }, [{ status: 'succeeded' }]), 0)).toEqual({});
  });

  it('asks for a plan, a bound L1 and a blocked audit', () => {
    expect(attentionMarks(overview(), 2)).toEqual({
      plan: 'Nothing planned yet',
      networks: 'Bind your L1',
      audit: '2 blocking findings',
    });
  });

  it('flags waiting deployments and an L1 without its registry, then without its relayer', () => {
    const noRegistry = { name: 'Moon', teleporter: { messenger: MESSENGER, registry: null }, relayer: 'not-running' };
    const marks = attentionMarks(
      overview({ runtime: { testnet: { l1: noRegistry } } }, [{ status: 'running' }, { status: 'proposed' }]),
      0,
    );
    expect(marks).toEqual({ deploy: '2 deployments waiting to continue', networks: 'ICM registry missing on your L1' });

    const noRelayer = {
      ...noRegistry,
      teleporter: { messenger: MESSENGER, registry: '0x4444444444444444444444444444444444444444' },
    };
    expect(
      attentionMarks(overview({ runtime: { testnet: { l1: noRelayer } } }, [{ status: 'succeeded' }]), 0).networks,
    ).toBe("Your L1's relayer is not running");
  });

  it('does not ask for an L1 when no blueprint uses one', () => {
    expect(attentionMarks(overview({ networks: { main: 'fuji-c-chain' } }, [{ status: 'succeeded' }]), 0)).toEqual({});
  });
});
