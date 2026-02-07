'use client';

import { useState, useEffect } from 'react';
import { isEmbeddedBrowser, getEmbeddedBrowserName, openInExternalBrowser } from '@/lib/utils/browserDetection';
import { ExternalLink, AlertCircle } from 'lucide-react';

export function EmbeddedBrowserWarning() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [browserName, setBrowserName] = useState<string | null>(null);

  useEffect(() => {
    const embedded = isEmbeddedBrowser();
    setIsEmbedded(embedded);
    if (embedded) {
      setBrowserName(getEmbeddedBrowserName());
    }
  }, []);

  if (!isEmbedded) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            Opening from {browserName}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            For security, Google and other providers require you to sign in from a regular browser like Safari or Chrome.
          </p>
          <button
            onClick={openInExternalBrowser}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-900/70 border border-amber-300 dark:border-amber-700 rounded-md transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Browser
          </button>
        </div>
      </div>
    </div>
  );
}
