import { AlertCircle } from 'lucide-react';
import { Button } from '../../components/Button';

export const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
  const errorString = typeof error.message === 'string' ? error.message : error.name || 'Unknown error';
  const isTestnetError = errorString?.includes('The error is mostly returned when the client requests');

  return (
    <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-3 px-5 py-4">
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
          Error
        </p>
        <div className="flex items-start gap-3 border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="min-w-0 break-words text-[13px] leading-relaxed text-red-800 dark:text-red-300">
            {errorString}
          </p>
        </div>
        {isTestnetError && (
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            This usually indicates that the Core wallet is not in testnet mode. Open Settings → Advanced → Enable
            Testnet mode.
          </p>
        )}
      </div>
      <div className="flex justify-end border-t border-zinc-200 bg-zinc-50/80 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <Button onClick={resetErrorBoundary} size="sm" className="w-auto">
          Try Again
        </Button>
      </div>
    </div>
  );
};
