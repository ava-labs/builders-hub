'use client';

import { useState, useCallback } from 'react';

interface LoginModalState {
  isOpen: boolean;
  callbackUrl?: string;
}

let globalLoginModalState: LoginModalState = {
  isOpen: false,
  callbackUrl: undefined,
};

const loginModalListeners = new Set<() => void>();

const notifyLoginModalChange = () => {
  loginModalListeners.forEach(listener => listener());
};

// Hook for components that need to trigger the login modal
export function useLoginModalTrigger() {
  const openLoginModal = useCallback((callbackUrl?: string) => {
    globalLoginModalState = {
      isOpen: true,
      callbackUrl,
    };
    notifyLoginModalChange();
  }, []);

  return {
    openLoginModal,
  };
}

// Hook for the LoginModal component to manage its state
export function useLoginModalState() {
  const [, forceUpdate] = useState({});

  // Subscribe to modal state changes
  const subscribeToChanges = useCallback(() => {
    const listener = () => forceUpdate({});
    loginModalListeners.add(listener);
    return () => {
      loginModalListeners.delete(listener);
    };
  }, []);

  const closeLoginModal = useCallback(() => {
    globalLoginModalState = {
      isOpen: false,
      callbackUrl: undefined,
    };
    notifyLoginModalChange();
  }, []);

  return {
    isOpen: globalLoginModalState.isOpen,
    callbackUrl: globalLoginModalState.callbackUrl,
    closeLoginModal,
    subscribeToChanges,
  };
}

