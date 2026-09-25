'use client';

import React, { useState } from 'react';
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { getL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { rpcUrlsEquivalent } from '@/components/toolbox/lib/rpcUrl';
import { preflightRpc } from '@/components/toolbox/lib/rpcPreflight';
import { decideRpcEdit, validateRpcUrlInput } from '@/components/toolbox/lib/editRpcUrl';
import { toast } from '@/lib/toast';
import { AlertCircle } from 'lucide-react';

/**
 * Focused editor for one network's RPC URL, discoverable from the header
 * network list and the My L1 dashboard. Issue #4450 showed the gap: the
 * only way to correct a stale URL was re-adding the chain through the Add
 * Chain modal's repair path, which nobody found.
 */
export interface EditRpcUrlOptions {
  evmChainId: number;
  name: string;
  rpcUrl: string;
  isTestnet: boolean;
}

let editRpcModalState: {
  isOpen: boolean;
  options: EditRpcUrlOptions | null;
  resolve: ((result: { success: boolean }) => void) | null;
} = {
  isOpen: false,
  options: null,
  resolve: null,
};

const editRpcListeners = new Set<() => void>();

const notifyEditRpcChange = () => {
  editRpcListeners.forEach((listener) => listener());
};

export function useEditRpcUrlModal() {
  const openEditRpcUrl = (options: EditRpcUrlOptions): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
      editRpcModalState = { isOpen: true, options, resolve };
      notifyEditRpcChange();
    });
  };

  return { openEditRpcUrl };
}

function useEditRpcModalState() {
  const [, forceUpdate] = useState({});

  React.useEffect(() => {
    const listener = () => forceUpdate({});
    editRpcListeners.add(listener);
    return () => {
      editRpcListeners.delete(listener);
    };
  }, []);

  const closeModal = (result: { success: boolean } = { success: false }) => {
    if (editRpcModalState.resolve) {
      editRpcModalState.resolve(result);
    }
    editRpcModalState = { isOpen: false, options: null, resolve: null };
    notifyEditRpcChange();
  };

  return {
    isOpen: editRpcModalState.isOpen,
    options: editRpcModalState.options,
    closeModal,
  };
}

export function EditRpcUrlModal() {
  const { isOpen, options, closeModal } = useEditRpcModalState();
  if (!isOpen || !options) return null;
  // Inner component mounts fresh on every open so form state never leaks
  // between networks (same pattern as AddChainModal).
  return <EditRpcUrlModalInner options={options} closeModal={closeModal} />;
}

function EditRpcUrlModalInner({
  options,
  closeModal,
}: {
  options: EditRpcUrlOptions;
  closeModal: (result?: { success: boolean }) => void;
}) {
  const [url, setUrl] = useState(options.rpcUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [allowForce, setAllowForce] = useState(false);

  const commit = (nextUrl: string) => {
    getL1ListStore(options.isTestnet).getState().updateL1(options.evmChainId, { rpcUrl: nextUrl });
    toast.success(`RPC URL updated for ${options.name}`);
    closeModal({ success: true });
  };

  const handleSave = async () => {
    const trimmed = url.trim();
    setMessage(null);
    setAllowForce(false);

    const inputError = validateRpcUrlInput(trimmed);
    if (inputError) {
      setMessage(inputError);
      return;
    }
    if (rpcUrlsEquivalent(trimmed, options.rpcUrl)) {
      closeModal({ success: false });
      return;
    }

    setIsChecking(true);
    try {
      const result = await preflightRpc(trimmed, options.evmChainId, {
        pageProtocol: typeof window !== 'undefined' ? window.location.protocol : undefined,
      });
      const decision = decideRpcEdit(result, options.evmChainId);
      if (decision.save) {
        commit(trimmed);
        return;
      }
      setMessage(decision.message);
      setAllowForce(decision.allowForce);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={() => closeModal({ success: false })}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent className="max-w-md">
          <DialogTitle>Edit RPC URL</DialogTitle>

          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {options.name} (chain ID {options.evmChainId}). Console tools read this URL for balances, deployments, and
            receipts.
          </p>

          <Input
            label="RPC URL"
            value={url}
            onChange={(value: string) => {
              setUrl(value);
              setMessage(null);
              setAllowForce(false);
            }}
            placeholder="https://your-node.example.com/ext/bc/<blockchainID>/rpc"
          />

          {message && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">{message}</p>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Your wallet keeps its own copy of this URL. If the wallet also has a stale URL, update it in the
            wallet&apos;s network settings.
          </p>

          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => closeModal({ success: false })}>
              Cancel
            </Button>
            {allowForce && (
              <Button variant="secondary" onClick={() => commit(url.trim())}>
                Save anyway
              </Button>
            )}
            <Button variant="primary" onClick={handleSave} loading={isChecking} disabled={isChecking}>
              Check and save
            </Button>
          </div>
        </DialogContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
