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
  retryCount: number;
}

const AUTO_RETRY_DELAY_MS = 500;
const MAX_AUTO_RETRIES = 5;
const RETRY_BUDGET_RESET_MS = 10_000;

export class StepErrorBoundary extends React.Component<StepErrorBoundaryProps, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: StepErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('StepErrorBoundary caught:', error, errorInfo);

    // Cancel any pending budget-reset timer — we just hit an error, so the
    // retry budget should not refill yet.
    if (this.resetTimeout !== null) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    // Transient errors during chain transitions (viem/wagmi internals seeing
    // partially-resolved state) recover cleanly on the next render. Auto-retry
    // up to `MAX_AUTO_RETRIES` times before falling back to the manual UI so
    // multi-switch flows aren't interrupted by every brief transition. A
    // genuine persistent error consumes the budget within ~3 seconds and
    // surfaces visibly.
    if (this.state.retryCount < MAX_AUTO_RETRIES && this.retryTimeout === null) {
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = null;
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, AUTO_RETRY_DELAY_MS);
    }
  }

  componentDidUpdate(_: StepErrorBoundaryProps, prevState: State) {
    // After a successful recovery (just cleared an error and the next render
    // didn't throw again), schedule a budget-reset so a long session that
    // survives several transients refills its retry budget instead of using
    // it up permanently.
    const justRecovered = prevState.hasError && !this.state.hasError && this.state.retryCount > 0;
    if (justRecovered && this.resetTimeout === null) {
      this.resetTimeout = setTimeout(() => {
        this.resetTimeout = null;
        this.setState({ retryCount: 0 });
      }, RETRY_BUDGET_RESET_MS);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout !== null) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.resetTimeout !== null) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
  }

  private handleManualRetry = () => {
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      // While an auto-retry is in flight (budget not exhausted yet, timer
      // pending), render nothing so the user doesn't see a flash of the
      // error UI. Once the budget is exhausted, fall through to the manual UI.
      if (this.state.retryCount < MAX_AUTO_RETRIES) {
        return null;
      }

      return (
        <div className="border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
                Step error
              </p>
              <p className="text-[13px] font-medium text-red-800 dark:text-red-300">
                {this.props.fallbackMessage || 'This step encountered an error'}
              </p>
              <p className="max-h-24 overflow-y-auto break-all font-mono text-[12px] text-red-700/80 dark:text-red-400/80">
                {this.state.error?.message}
              </p>
              <button
                type="button"
                onClick={this.handleManualRetry}
                className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-700 underline-offset-4 transition-colors hover:text-red-900 hover:underline dark:text-red-300 dark:hover:text-red-100"
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
