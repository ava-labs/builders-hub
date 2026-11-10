'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Full screen for a panel without remounting it: the browser's Fullscreen API
 * on the element when available (it escapes any transformed ancestor), with
 * the element's own fixed overlay classes as the fallback. Esc, or leaving
 * native full screen, turns it off; the page behind doesn't scroll meanwhile.
 */
export function useFullScreen(ref: RefObject<HTMLElement | null>, on: boolean, setOn: (on: boolean) => void) {
  const setOnRef = useRef(setOn);
  setOnRef.current = setOn;

  useEffect(() => {
    if (!on) return;
    const el = ref.current;
    if (el && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) setOnRef.current(false);
    };
    const onChange = () => {
      if (!document.fullscreenElement) setOnRef.current(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
    };
  }, [on, ref]);
}
