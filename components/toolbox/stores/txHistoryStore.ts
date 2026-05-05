import { createFlowStore } from './createFlowStore';

const MAX_TX_HISTORY = 200;

export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface TxRecord {
  id: string;
  timestamp: number;
  type: 'evm' | 'pchain';
  network: 'fuji' | 'mainnet';
  operation: string;
  txHash: string;
  status: TxStatus;
  contractAddress?: string;
  chainId?: number;
  error?: string;
}

interface TxHistoryState {
  transactions: TxRecord[];
  addTx: (tx: Omit<TxRecord, 'id' | 'timestamp'>) => void;
  updateTxStatus: (txHash: string, status: 'confirmed' | 'failed', error?: string) => void;
  clearHistory: () => void;
  reset: () => void;
}

const initialValues = {
  transactions: [] as TxRecord[],
};

const { getStore: getTxHistoryStore, useStore: useTxHistoryStore } = createFlowStore<TxHistoryState>({
  name: 'tx-history-store',
  storeCreator: (set) => ({
    ...initialValues,

    addTx: (tx) =>
      set((state) => {
        const record: TxRecord = {
          ...tx,
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
        };
        const next = [record, ...state.transactions].slice(0, MAX_TX_HISTORY);
        return { transactions: next };
      }),

    updateTxStatus: (txHash, status, error) =>
      set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.txHash === txHash ? { ...tx, status, ...(error ? { error } : {}) } : tx,
        ),
      })),

    clearHistory: () => set({ transactions: [] }),

    reset: () => set({ ...initialValues }),
  }),
  partialize: (state) => ({
    transactions: state.transactions,
  }),
});

export { getTxHistoryStore, useTxHistoryStore };
