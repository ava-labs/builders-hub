'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';

/** A one-item menu at the pointer, the way a right-click menu sits on the code. */
export function SelectionMenu({
  x,
  y,
  label,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  onPick: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)),
    });
  }, [x, y]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const close = () => onCloseRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-[200] border border-zinc-200 bg-white py-1 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <button
        type="button"
        role="menuitem"
        // Keep the editor selection; a normal click would collapse it before the action runs.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onPick}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        {label}
      </button>
    </div>
  );
}
