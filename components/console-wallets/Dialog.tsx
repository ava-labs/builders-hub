'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LABEL } from '@/components/studio/ui';

/** Open dialogs, innermost last: Esc closes only the top one. */
const stack: object[] = [];

/** A plain modal in the console's square style; Esc and the backdrop close it. */
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const token = {};
    stack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (stack[stack.length - 1] === token) closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      stack.splice(stack.indexOf(token), 1);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-zinc-950/40 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`my-auto flex w-full flex-col border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex h-10 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
          <span className={LABEL}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
