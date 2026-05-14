'use client';

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface StepErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retriedOnce: boolean;
}

const AUTO_RETRY_DELAY_MS = 500;

export class StepErrorBoundary extends React.Component<StepErrorBoundaryProps, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: StepErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retriedOnce: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('StepErrorBoundary caught:', error, errorInfo);

    // Transient first-mount errors (notably the brief window during which
    // wagmi has torn down its wallet client mid-`switchChain` and viem
    // internals throw on partially-resolved chain state) recover cleanly on
    // the next render. Auto-retry exactly once per boundary instance so the
    // user doesn't see a flash of the error UI; if the error reproduces, the
    // manual "Try again" affordance still appears.
    if (!this.state.retriedOnce && this.retryTimeout === null) {
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = null;
        this.setState({ hasError: false, error: null, retriedOnce: true });
      }, AUTO_RETRY_DELAY_MS);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  private handleManualRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // During the brief auto-retry window we render nothing so the user
      // doesn't see a flash of the error UI. If the retry fails, the next
      // catch lands with `retriedOnce: true` and the manual UI shows.
      if (!this.state.retriedOnce) {
        return null;
      }

      return (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {this.props.fallbackMessage || 'This step encountered an error'}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all max-h-24 overflow-y-auto">
                {this.state.error?.message}
              </p>
              <button
                type="button"
                onClick={this.handleManualRetry}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
