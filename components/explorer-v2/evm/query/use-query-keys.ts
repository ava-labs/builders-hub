"use client";

/* the query page's keys: / asks, R opens the rows, Escape steps back */

import { type RefObject, useEffect, useRef } from "react";
import type { Selection } from "@/lib/explorer-query/selection";

export function useQueryKeys(
  state: { inspect: boolean; drill: boolean; sel: number; rows: number; answer: boolean },
  {
    inputRef,
    setInspect,
    setSel,
    popZoom,
  }: {
    inputRef: RefObject<HTMLTextAreaElement | null>;
    setInspect: (next: boolean | ((open: boolean) => boolean)) => void;
    setSel: (s: Selection) => void;
    popZoom: () => void;
  },
) {
  const keyState = useRef(state);
  keyState.current = state;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a focused chart handles its own Escape first (it clears the picks)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const k = keyState.current;
      if (e.key === "/") {
        e.preventDefault();
        setInspect(false);
        inputRef.current?.focus();
      } else if ((e.key === "r" || e.key === "R") && k.answer && k.rows > 0) {
        e.preventDefault();
        setInspect((v) => !v);
      } else if (e.key === "Escape") {
        if (k.inspect) setInspect(false);
        else if (k.drill) popZoom();
        else if (k.sel) setSel([]);
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popZoom, setInspect, setSel, inputRef]);
}
