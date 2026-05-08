'use client';

import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/toolbox/components/AlertDialog';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['?'], description: 'Show this overlay' },
  { keys: ['←', '→'], description: 'Move between phases (skips blocked)' },
  { keys: ['⌘', 'Enter'], description: 'Submit the active inspector primary action (macOS)' },
  { keys: ['Ctrl', 'Enter'], description: 'Submit the active inspector primary action (others)' },
];

/**
 * Discoverability surface for the keyboard shortcuts. Opens via the
 * `?` keystroke (when not focused inside an editable field) or via the
 * trigger button in the top bar. Uses the project's `<AlertDialog>`
 * primitive to stay visually consistent with the reset-bridge confirm.
 *
 * The trigger is exposed so the BridgeConsole can render it inline in
 * the top bar's action group.
 */
export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  // `?` opens the overlay. Not bound when the user is inside an
  // editable field — let them type literal question marks normally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts"
        className="hidden md:inline-flex items-center justify-center w-8 h-8 text-muted-foreground border border-border rounded-lg hover:bg-muted cursor-pointer"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <AlertDialogTitle>Keyboard shortcuts</AlertDialogTitle>
                <AlertDialogDescription>
                  Power-user shortcuts for the bridge console. None require Shift.
                </AlertDialogDescription>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 -m-1 rounded"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </AlertDialogHeader>

          <div className="space-y-3">
            {SHORTCUTS.map((s) => (
              <div key={s.keys.join('+')} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground/80">{s.description}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded border border-border bg-background text-xs font-mono text-foreground/80"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
