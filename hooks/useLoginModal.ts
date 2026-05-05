'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * Login modal state + cross-component event bus.
 *
 * Previously: module-level mutable singleton + three `Set<() => void>`
 * listener pools + `forceUpdate({})` to re-render subscribers. That model
 * is unsafe under concurrent React (writes in the singleton aren't visible
 * to suspended renders) and bypasses every devtool that knows how to
 * inspect Zustand stores.
 *
 * Now: one Zustand store with explicit `isOpen` / `callbackUrl` state and
 * monotonic version counters for the two pub/sub events the rest of the
 * codebase listens for (`new-user-login`, `login-complete`). Listener
 * hooks watch their respective version, skip the mount-time render, and
 * fire the callback only on actual increments — same external API as
 * before, including the existing `triggerNewUserLogin` /
 * `triggerLoginComplete` exports that fire from non-React entry points.
 */
interface LoginModalStore {
  isOpen: boolean;
  callbackUrl?: string;
  /** Bumped on every `triggerNewUserLogin()` call. Listeners watch the
   *  numeric value and react to changes — never read directly. */
  newUserLoginVersion: number;
  /** Bumped on every `triggerLoginComplete()` call. */
  loginCompleteVersion: number;
  open: (callbackUrl?: string) => void;
  close: () => void;
  bumpNewUserLogin: () => void;
  bumpLoginComplete: () => void;
}

const useLoginModalStore = create<LoginModalStore>((set) => ({
  isOpen: false,
  callbackUrl: undefined,
  newUserLoginVersion: 0,
  loginCompleteVersion: 0,
  open: (callbackUrl) => {
    // Default to the current URL so post-login the user returns to the page
    // they were on (VerifyEmail fires window.location.href = callbackUrl on
    // success). Without this, callbackUrl falls back to "/" and the user
    // gets bounced to the homepage instead of the tool that gated them.
    const resolved =
      callbackUrl ??
      (typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : undefined);
    set({ isOpen: true, callbackUrl: resolved });
  },
  close: () => set({ isOpen: false, callbackUrl: undefined }),
  bumpNewUserLogin: () =>
    set((s) => ({ newUserLoginVersion: s.newUserLoginVersion + 1 })),
  bumpLoginComplete: () =>
    set((s) => ({ loginCompleteVersion: s.loginCompleteVersion + 1 })),
}));

// Function to trigger new user login event (called from VerifyEmail).
// Stays a free function for non-React call sites.
export function triggerNewUserLogin() {
  useLoginModalStore.getState().bumpNewUserLogin();
}

// Function to trigger login complete event (called after full flow completes).
export function triggerLoginComplete() {
  useLoginModalStore.getState().bumpLoginComplete();
}

// Hook for components that need to trigger the login modal
export function useLoginModalTrigger() {
  const open = useLoginModalStore((s) => s.open);
  return { openLoginModal: open };
}

// Hook for the LoginModal component to manage its state
export function useLoginModalState() {
  const isOpen = useLoginModalStore((s) => s.isOpen);
  const callbackUrl = useLoginModalStore((s) => s.callbackUrl);
  const closeLoginModal = useLoginModalStore((s) => s.close);
  return { isOpen, callbackUrl, closeLoginModal };
}

/**
 * Subscribe to a counter-backed pub/sub channel. Skips the initial render
 * (so we don't fire the callback for the value the listener mounted with)
 * and fires on every subsequent increment.
 *
 * Wrapping `useLoginModalStore`'s version selector in this helper keeps
 * the two listener hooks structurally identical — drift between them
 * (e.g. one missing the initial-skip) used to cause subtle "callback
 * fired twice on mount" bugs.
 */
function useVersionedListener(version: number, callback: () => void) {
  const seenVersionRef = useRef<number | null>(null);
  // Stash the latest callback so subscribers don't have to memoize their
  // closure to avoid re-firing on every render.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (seenVersionRef.current === null) {
      seenVersionRef.current = version;
      return;
    }
    if (version !== seenVersionRef.current) {
      seenVersionRef.current = version;
      callbackRef.current();
    }
  }, [version]);
}

// Hook to listen for new user login events
export function useNewUserLoginListener(callback: () => void) {
  const version = useLoginModalStore((s) => s.newUserLoginVersion);
  useVersionedListener(version, callback);
}

// Hook to listen for login complete events (after full flow: OTP + terms + profile)
export function useLoginCompleteListener(callback: () => void) {
  const version = useLoginModalStore((s) => s.loginCompleteVersion);
  useVersionedListener(version, callback);
}
