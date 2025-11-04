'use client';

import { APIPage } from 'fumadocs-openapi/ui';
import { useEffect } from 'react';

interface APIPageWrapperProps {
  apiKey: string;
  storageKey: string;
  pageProps: any;
}

export function APIPageWrapper({ apiKey, storageKey, pageProps }: APIPageWrapperProps) {
  useEffect(() => {
    // Load this API's specific storage or clear if none exists
    const apiStorage = localStorage.getItem(storageKey);
    if (apiStorage) {
      localStorage.setItem('apiBaseUrl', apiStorage);
    } else {
      localStorage.removeItem('apiBaseUrl');
    }

    // Save to API-specific storage when fumadocs updates the main key
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

  return <APIPage {...pageProps} />;
}

