'use client';

import { useState, useCallback, useEffect } from 'react';

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

// Separate listeners for new user login events
const newUserLoginListeners = new Set<() => void>();

const notifyNewUserLogin = () => {
  newUserLoginListeners.forEach(listener => listener());
};

// Listeners for login flow complete events (after terms + profile)
const loginCompleteListeners = new Set<() => void>();

const notifyLoginComplete = () => {
  loginCompleteListeners.forEach(listener => listener());
};

// Function to trigger new user login event (called from VerifyEmail)
export function triggerNewUserLogin() {
  notifyNewUserLogin();
}

// Function to trigger login complete event (called after full flow completes)
export function triggerLoginComplete() {
  notifyLoginComplete();
}

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

  // Subscribe to modal state changes on mount
  useEffect(() => {
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
  };
}

// Hook to listen for new user login events
export function useNewUserLoginListener(callback: () => void) {
  useEffect(() => {
    newUserLoginListeners.add(callback);
    return () => {
      newUserLoginListeners.delete(callback);
    };
  }, [callback]);
}

// Hook to listen for login complete events (after full flow: OTP + terms + profile)
export function useLoginCompleteListener(callback: () => void) {
  useEffect(() => {
    loginCompleteListeners.add(callback);
    return () => {
      loginCompleteListeners.delete(callback);
    };
  }, [callback]);
}

