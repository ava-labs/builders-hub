"use client";

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useCallback, useMemo } from 'react';
import { L1ListItem, useL1List, useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { STORE_VERSION, localStorageComp } from '@/components/toolbox/stores/utils';

// Types for ICTT Workbench
export type TokenType = 'erc20-to-erc20' | 'erc20-to-native' | 'native-to-native' | 'native-to-erc20';

export type ConnectionStatus =
  | 'not-started'
  | 'home-deployed'
  | 'remote-deployed'
  | 'registered'
  | 'collateralized'
  | 'live';

export interface TokenInfo {
  address?: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
}

export interface BridgeConnection {
  id: string;
  sourceChainId: string;   // The chain where token home lives
  targetChainId: string;   // The chain where token remote lives (user's L1)
  tokenType: TokenType;
  token: TokenInfo;
  status: ConnectionStatus;
  contracts: {
    homeAddress?: string;
    remoteAddress?: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface PendingConnection {
  sourceChainId: string;
  targetChainId: string;
  step: 'select-token' | 'select-type' | 'configure' | 'confirm';
  tokenType?: TokenType;
  token?: Partial<TokenInfo>;
}

interface ICTTWorkbenchState {
  connections: BridgeConnection[];
  pendingConnection: PendingConnection | null;

  // Actions
  addConnection: (connection: Omit<BridgeConnection, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateConnection: (id: string, updates: Partial<BridgeConnection>) => void;
  removeConnection: (id: string) => void;
  getConnectionsByChain: (chainId: string) => BridgeConnection[];
  getConnectionBetweenChains: (sourceId: string, targetId: string) => BridgeConnection | undefined;

  // Pending connection actions
  startConnection: (sourceChainId: string, targetChainId: string) => void;
  updatePendingConnection: (updates: Partial<PendingConnection>) => void;
  cancelPendingConnection: () => void;
  finalizePendingConnection: () => string | null;

  // Reset
  reset: () => void;
}

const initialState = {
  connections: [] as BridgeConnection[],
  pendingConnection: null as PendingConnection | null,
};

// Create a unique ID generator
const generateId = () => `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Create the store
export const useICTTWorkbenchStore = create<ICTTWorkbenchState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addConnection: (connection) => {
        const id = generateId();
        const now = Date.now();
        const newConnection: BridgeConnection = {
          ...connection,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          connections: [...state.connections, newConnection],
        }));
        return id;
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id
              ? { ...conn, ...updates, updatedAt: Date.now() }
              : conn
          ),
        }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
        }));
      },

      getConnectionsByChain: (chainId) => {
        return get().connections.filter(
          (conn) => conn.sourceChainId === chainId || conn.targetChainId === chainId
        );
      },

      getConnectionBetweenChains: (sourceId, targetId) => {
        return get().connections.find(
          (conn) =>
            (conn.sourceChainId === sourceId && conn.targetChainId === targetId) ||
            (conn.sourceChainId === targetId && conn.targetChainId === sourceId)
        );
      },

      startConnection: (sourceChainId, targetChainId) => {
        set({
          pendingConnection: {
            sourceChainId,
            targetChainId,
            step: 'select-token',
          },
        });
      },

      updatePendingConnection: (updates) => {
        set((state) => ({
          pendingConnection: state.pendingConnection
            ? { ...state.pendingConnection, ...updates }
            : null,
        }));
      },

      cancelPendingConnection: () => {
        set({ pendingConnection: null });
      },

      finalizePendingConnection: () => {
        const { pendingConnection, addConnection } = get();
        if (!pendingConnection || !pendingConnection.token || !pendingConnection.tokenType) {
          return null;
        }

        const id = addConnection({
          sourceChainId: pendingConnection.sourceChainId,
          targetChainId: pendingConnection.targetChainId,
          tokenType: pendingConnection.tokenType,
          token: pendingConnection.token as TokenInfo,
          status: 'not-started',
          contracts: {},
        });

        set({ pendingConnection: null });
        return id;
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: `${STORE_VERSION}-ictt-workbench`,
      storage: createJSONStorage(localStorageComp),
    }
  )
);

// Helper hooks
export function useICTTWorkbench() {
  const store = useICTTWorkbenchStore();
  const selectedL1 = useSelectedL1()();
  const l1List = useL1List();
  const { walletChainId } = useWalletStore();

  // Get the center chain (user's currently selected L1)
  const centerChain = useMemo(() => {
    return selectedL1;
  }, [selectedL1]);

  // Get all available chains that can be connected
  const availableChains = useMemo(() => {
    if (!centerChain) return l1List;
    return l1List.filter((l1: L1ListItem) => l1.id !== centerChain.id);
  }, [l1List, centerChain]);

  // Get chains that are already connected to the center chain
  const connectedChains = useMemo(() => {
    if (!centerChain) return [];
    const connections = store.getConnectionsByChain(centerChain.id);
    const connectedIds = new Set<string>();

    connections.forEach((conn) => {
      if (conn.sourceChainId === centerChain.id) {
        connectedIds.add(conn.targetChainId);
      } else {
        connectedIds.add(conn.sourceChainId);
      }
    });

    return l1List.filter((l1: L1ListItem) => connectedIds.has(l1.id));
  }, [store.connections, centerChain, l1List]);

  // Get connections for the center chain
  const centerChainConnections = useMemo(() => {
    if (!centerChain) return [];
    return store.getConnectionsByChain(centerChain.id);
  }, [store.connections, centerChain]);

  // Get chain by ID helper
  const getChainById = useCallback(
    (chainId: string): L1ListItem | undefined => {
      return l1List.find((l1: L1ListItem) => l1.id === chainId);
    },
    [l1List]
  );

  // Check if we can connect to a chain (not already connected)
  const canConnectToChain = useCallback(
    (chainId: string): boolean => {
      if (!centerChain) return false;
      if (chainId === centerChain.id) return false;

      const existingConnection = store.getConnectionBetweenChains(
        centerChain.id,
        chainId
      );
      return !existingConnection;
    },
    [centerChain, store.connections]
  );

  // Start a new connection from the center chain to another chain
  const startConnectionToChain = useCallback(
    (targetChainId: string) => {
      if (!centerChain) return;
      // Source is always center chain, target is the chain we're connecting to
      store.startConnection(centerChain.id, targetChainId);
    },
    [centerChain, store.startConnection]
  );

  return {
    // State
    centerChain,
    availableChains,
    connectedChains,
    connections: centerChainConnections,
    allConnections: store.connections,
    pendingConnection: store.pendingConnection,

    // Helpers
    getChainById,
    canConnectToChain,

    // Actions
    startConnectionToChain,
    addConnection: store.addConnection,
    updateConnection: store.updateConnection,
    removeConnection: store.removeConnection,
    updatePendingConnection: store.updatePendingConnection,
    cancelPendingConnection: store.cancelPendingConnection,
    finalizePendingConnection: store.finalizePendingConnection,
    reset: store.reset,
  };
}

// Status helpers
export const statusLabels: Record<ConnectionStatus, string> = {
  'not-started': 'Not Started',
  'home-deployed': 'Home Deployed',
  'remote-deployed': 'Remote Deployed',
  'registered': 'Registered',
  'collateralized': 'Collateralized',
  'live': 'Live',
};

export const statusColors: Record<ConnectionStatus, { bg: string; text: string; dot: string }> = {
  'not-started': { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400', dot: 'bg-zinc-400' },
  'home-deployed': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-400' },
  'remote-deployed': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-400' },
  'registered': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-400' },
  'collateralized': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-400' },
  'live': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-400' },
};

export const tokenTypeLabels: Record<TokenType, string> = {
  'erc20-to-erc20': 'ERC20 to ERC20',
  'erc20-to-native': 'ERC20 to Native',
  'native-to-native': 'Native to Native',
  'native-to-erc20': 'Native to ERC20',
};

// Helper to get progress percentage for a connection
export function getConnectionProgress(status: ConnectionStatus): number {
  const statusOrder: ConnectionStatus[] = [
    'not-started',
    'home-deployed',
    'remote-deployed',
    'registered',
    'collateralized',
    'live',
  ];
  const currentIndex = statusOrder.indexOf(status);
  return Math.round(((currentIndex + 1) / statusOrder.length) * 100);
}

// Helper to get step index for a status (0-3 for deployment steps)
export function getStepIndexForStatus(status: ConnectionStatus): number {
  switch (status) {
    case 'not-started':
      return 0;
    case 'home-deployed':
      return 1;
    case 'remote-deployed':
      return 2;
    case 'registered':
    case 'collateralized':
    case 'live':
      return 3;
    default:
      return 0;
  }
}
