"use client";

import { useState, useCallback } from "react";

interface UseCopyToClipboardOptions {
  resetDelay?: number;
  onSuccess?: (text: string, id: string) => void;
  onError?: (error: Error) => void;
}

interface UseCopyToClipboardReturn {
  copiedId: string | null;
  copyToClipboard: (text: string, id: string) => Promise<void>;
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const { resetDelay = 1500, onSuccess, onError } = options;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        onSuccess?.(text, id);
        setTimeout(() => setCopiedId(null), resetDelay);
      } catch (err) {
        console.error("Failed to copy:", err);
        onError?.(err instanceof Error ? err : new Error("Failed to copy"));
      }
    },
    [resetDelay, onSuccess, onError]
  );

  return { copiedId, copyToClipboard };
}
