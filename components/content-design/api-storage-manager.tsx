'use client';

import { useEffect } from 'react';

interface APIStorageManagerProps {
  storageKey: string;
}

/**
 * Client component that manages API-specific localStorage for fumadocs-openapi.
 * Fumadocs uses a hardcoded 'apiBaseUrl' key, so we sync between that and API-specific keys.
 */
export function APIStorageManager({ storageKey }: APIStorageManagerProps) {
  useEffect(() => {
    // Load this API's specific storage into fumadocs' expected key
    const apiStorage = localStorage.getItem(storageKey);
    if (apiStorage) {
      localStorage.setItem('apiBaseUrl', apiStorage);
    } else {
      localStorage.removeItem('apiBaseUrl');
    }

    // Sync changes back to API-specific key
    const interval = setInterval(() => {
      const currentBaseUrl = localStorage.getItem('apiBaseUrl');
      if (currentBaseUrl) {
        localStorage.setItem(storageKey, currentBaseUrl);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      // Save current state to API-specific key before unmounting
      const currentBaseUrl = localStorage.getItem('apiBaseUrl');
      if (currentBaseUrl) {
        localStorage.setItem(storageKey, currentBaseUrl);
      }
    };
  }, [storageKey]);

  return null; // This component only manages side effects
}

