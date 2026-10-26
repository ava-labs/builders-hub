'use client';

import { ThemeToggle } from 'fumadocs-ui/components/layout/theme-toggle';
import { useTheme } from 'next-themes';
import { useCallback } from 'react';
import { flushSync } from 'react-dom';

/** Marks <html> for the length of the reveal: the CSS in app/global.css (site-theme-switch) applies only then. */
const REVEAL_ATTRIBUTE = 'data-theme-reveal';
const REVEAL_X = '--theme-reveal-x';
const REVEAL_Y = '--theme-reveal-y';
const REVEAL_R = '--theme-reveal-r';

type Box = { left: number; top: number; width: number; height: number };

/** The reveal circle: centred on the toggle, with a radius that reaches the farthest corner of the window. */
export function revealCircle(toggle: Box, viewport: { width: number; height: number }) {
  const x = toggle.left + toggle.width / 2;
  const y = toggle.top + toggle.height / 2;
  const r = Math.ceil(Math.hypot(Math.max(x, viewport.width - x), Math.max(y, viewport.height - y)));
  return { x, y, r };
}

/** The reveal in progress: a press during it starts a new one, which then owns the marks on <html>. */
let activeReveal: ViewTransition | undefined;

/**
 * site-theme-switch: switch light and dark inside a view transition. With motion allowed, the CSS reveals the new
 * theme in a circle that grows from `origin`; under Reduce Motion it cross-fades the two pages in 150ms instead. In a
 * browser without view transitions the theme swaps at once (next-themes holds every CSS transition for that frame).
 */
export function switchTheme(origin: Element, setTheme: (theme: string) => void): void {
  const root = document.documentElement;
  const next = root.classList.contains('dark') ? 'light' : 'dark';
  if (typeof document.startViewTransition !== 'function') {
    setTheme(next);
    return;
  }
  const { x, y, r } = revealCircle(origin.getBoundingClientRect(), {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  root.style.setProperty(REVEAL_X, `${x}px`);
  root.style.setProperty(REVEAL_Y, `${y}px`);
  root.style.setProperty(REVEAL_R, `${r}px`);
  root.setAttribute(REVEAL_ATTRIBUTE, '');
  // next-themes applies the class in an effect: flushSync runs it before the browser captures the new theme
  const transition = document.startViewTransition(() => flushSync(() => setTheme(next)));
  activeReveal = transition;
  const done = () => {
    if (activeReveal !== transition) return;
    activeReveal = undefined;
    root.removeAttribute(REVEAL_ATTRIBUTE);
    [REVEAL_X, REVEAL_Y, REVEAL_R].forEach((property) => root.style.removeProperty(property));
  };
  transition.finished.then(done, done);
}

/** The switch bound to next-themes, for the desktop toggle and the phone menu's toggle alike. */
export function useThemeSwitch(): (origin: Element) => void {
  const { setTheme } = useTheme();
  return useCallback((origin: Element) => switchTheme(origin, setTheme), [setTheme]);
}

/**
 * The navbar's theme toggle: fumadocs' own (same markup, so the navbar CSS and layout are unchanged), with its click
 * going through switchTheme. Its props spread after its own onClick, so this onClick replaces that one.
 */
export function ThemeSwitch() {
  const toggle = useThemeSwitch();
  return <ThemeToggle onClick={(event) => toggle(event.currentTarget)} />;
}
