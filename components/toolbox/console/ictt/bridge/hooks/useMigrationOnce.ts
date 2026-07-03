'use client';

import { useEffect, useState } from 'react';
import { useL1List } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import {
  adoptOrphans,
  hasMigrated,
  markMigrated,
  migrateLegacyState,
} from '@/components/toolbox/stores/migrations/ictt-v1-to-v2';

interface MigrationStatus {
  ran: boolean;
  didMigrate: boolean;
  orphanCount: number;
}

/**
 * Runs the legacy-flat-keys → v2-bridge-graph migration exactly once
 * per browser. Idempotent across React strict-mode double-invocations
 * via the persisted `ictt-bridges-migrated` flag.
 */
export function useMigrationOnce(): MigrationStatus {
  const l1List = useL1List();
  const upsertBridge = useIcttBridgeStore((s) => s.upsertBridge);
  const upsertRemote = useIcttBridgeStore((s) => s.upsertRemote);
  const [status, setStatus] = useState<MigrationStatus>({ ran: false, didMigrate: false, orphanCount: 0 });

  useEffect(() => {
    if (status.ran) return;
    if (typeof window === 'undefined') return;
    if (hasMigrated()) {
      setStatus({ ran: true, didMigrate: false, orphanCount: 0 });
      return;
    }
    if (!l1List || l1List.length === 0) return;

    const result = migrateLegacyState(l1List);
    if (!result.didMigrate) {
      markMigrated();
      setStatus({ ran: true, didMigrate: false, orphanCount: 0 });
      return;
    }

    const adopted = adoptOrphans(result.bridges, result.orphanRemotes);
    for (const bridge of adopted.bridges) {
      upsertBridge({ ...bridge, remotes: [] });
      for (const remote of bridge.remotes) {
        upsertRemote(bridge.id, remote);
      }
    }

    markMigrated();
    setStatus({ ran: true, didMigrate: true, orphanCount: adopted.remainingOrphans.length });
  }, [l1List, status.ran, upsertBridge, upsertRemote]);

  return status;
}
