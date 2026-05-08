'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/toolbox/components/AlertDialog';

interface ResetBridgeButtonProps {
  homeChainId: string | undefined;
  remoteChainIds: string[];
  onAfterReset: () => void;
  /** Disable the button entirely when nothing has been deployed yet. */
  hasAnythingToReset: boolean;
}

/**
 * Top-bar action that clears the current bridge state and starts the
 * user over from the Token phase. Useful when iterating during testing —
 * the alternative is opening DevTools and manually clearing localStorage
 * keys.
 *
 * Scope of the reset:
 *   - Home chain's toolbox store: ICTT-specific keys (token + home +
 *     legacy mirror remote)
 *   - Each remote chain's toolbox store: ICTT remote keys only
 *   - The bridge activity feed (delegated to the parent via
 *     `onAfterReset`)
 *
 * Explicitly does NOT touch: teleporter registry, validator manager,
 * staking manager, or any non-ICTT toolbox keys. Other tools running
 * on the same chain are unaffected.
 */
export function ResetBridgeButton({
  homeChainId,
  remoteChainIds,
  onAfterReset,
  hasAnythingToReset,
}: ResetBridgeButtonProps) {
  const [open, setOpen] = useState(false);

  const handleReset = () => {
    if (homeChainId) {
      const home = getToolboxStore(homeChainId).getState();
      home.setExampleErc20Address('');
      home.setErc20TokenHomeAddress('');
      home.setNativeTokenHomeAddress('');
      // Legacy compatibility — the old wizard also wrote remote addresses
      // to the active chain's store. Clear them so reset is total.
      home.setErc20TokenRemoteAddress('');
      home.setNativeTokenRemoteAddress('');
    }
    for (const remoteId of remoteChainIds) {
      const remote = getToolboxStore(remoteId).getState();
      remote.setErc20TokenRemoteAddress('');
      remote.setNativeTokenRemoteAddress('');
    }
    onAfterReset();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasAnythingToReset}
        title={hasAnythingToReset ? 'Reset bridge' : 'Nothing to reset yet'}
        className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground/80 border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this bridge?</AlertDialogTitle>
            <AlertDialogDescription>
              Clears the deployed token, TokenHome, and TokenRemote contract addresses for this bridge so you can start
              over. The on-chain contracts stay deployed — only your local references are removed. Activity history is
              also cleared.
              <br />
              <br />
              Other tools (Teleporter Registry, validator manager, etc.) are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleReset}>
              Reset bridge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
