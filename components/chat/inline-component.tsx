"use client";

import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Loader2, AlertTriangle } from "lucide-react";
import { componentRegistry } from "@/lib/chat/registry";
import type { ComponentName } from "@/lib/chat/catalog";

interface InlineChatComponentProps {
  componentType: string;
  props?: Record<string, any>;
}

function LoadingSkeleton() {
  return (
    <div className="rounded-xl border bg-muted/30 p-8 flex items-center justify-center gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Loading component...</span>
    </div>
  );
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-destructive">Failed to load component</p>
          <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
          <button
            onClick={resetErrorBoundary}
            className="mt-3 text-xs font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a component from the chat registry inline in a message.
 * Used by ChatMessage when it encounters a render_component tool invocation.
 */
export default function InlineChatComponent({ componentType, props = {} }: InlineChatComponentProps) {
  const Component = componentRegistry[componentType as ComponentName];

  if (!Component) {
    return (
      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Unknown component: <code className="font-mono">{componentType}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-xl border overflow-hidden">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={<LoadingSkeleton />}>
          <Component {...props} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
