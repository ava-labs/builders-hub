'use client';

import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/toolbox/components/Input';
import { EYEBROW } from '@/components/toolbox/console/icm/ui';

interface AdvancedSettingsProps {
  logLevel: 'info' | 'debug' | 'warn' | 'error';
  apiPort: number;
  storageLocation: string;
  processMissedBlocks: boolean;
  showAdvancedSettings: boolean;
  onLogLevelChange: (level: 'info' | 'debug' | 'warn' | 'error') => void;
  onApiPortChange: (port: number) => void;
  onStorageLocationChange: (location: string) => void;
  onProcessMissedBlocksChange: (checked: boolean) => void;
  onToggle: (open: boolean) => void;
  onHighlight: (field: string) => void;
  onClearHighlight: () => void;
}

export function AdvancedSettings({
  logLevel,
  apiPort,
  storageLocation,
  processMissedBlocks,
  showAdvancedSettings,
  onLogLevelChange,
  onApiPortChange,
  onStorageLocationChange,
  onProcessMissedBlocksChange,
  onToggle,
  onHighlight,
  onClearHighlight,
}: AdvancedSettingsProps) {
  return (
    <details
      className="group/adv border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      open={showAdvancedSettings}
      onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
    >
      <summary className="group/link flex cursor-pointer select-none list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline gap-3">
          <span className="text-[14px] font-semibold text-zinc-900 underline-offset-4 group-hover/link:underline dark:text-zinc-50">
            Advanced settings
          </span>
          <span className={EYEBROW}>Optional</span>
        </span>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 text-zinc-400 transition-transform group-hover/link:text-zinc-900 group-open/adv:rotate-180 dark:group-hover/link:text-zinc-100"
        />
      </summary>
      <div className="grid grid-cols-1 gap-x-5 border-t border-zinc-200 px-5 pt-5 sm:grid-cols-2 dark:border-zinc-800">
        <div
          className="mb-6 flex flex-col gap-2"
          onFocus={() => onHighlight('logLevel')}
          onBlur={onClearHighlight}
          onMouseEnter={() => onHighlight('logLevel')}
          onMouseLeave={onClearHighlight}
        >
          <label htmlFor="relayer-log-level" className={EYEBROW}>
            Log level
          </label>
          <select
            id="relayer-log-level"
            value={logLevel}
            onChange={(e) => onLogLevelChange(e.target.value as 'info' | 'debug' | 'warn' | 'error')}
            className="h-10 w-full rounded-none border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 transition-colors hover:border-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-zinc-300"
          >
            <option value="info">Info (recommended)</option>
            <option value="debug">Debug</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">How much the relayer logs.</p>
        </div>

        <div
          onFocus={() => onHighlight('apiPort')}
          onBlur={onClearHighlight}
          onMouseEnter={() => onHighlight('apiPort')}
          onMouseLeave={onClearHighlight}
        >
          <Input
            id="relayer-api-port"
            label="API port"
            value={apiPort.toString()}
            onChange={(value) => onApiPortChange(Number(value))}
            placeholder="8080"
            type="number"
            className="font-mono"
            helperText="Port for the relayer API."
          />
        </div>

        <div
          onFocus={() => onHighlight('storage')}
          onBlur={onClearHighlight}
          onMouseEnter={() => onHighlight('storage')}
          onMouseLeave={onClearHighlight}
        >
          <Input
            id="relayer-storage"
            label="Storage location"
            value={storageLocation}
            onChange={onStorageLocationChange}
            placeholder="./awm-relayer-storage"
            className="font-mono"
            helperText="Folder for the relayer's state."
          />
        </div>

        <div
          className="mb-6 flex flex-col justify-center"
          onMouseEnter={() => onHighlight('processMissedBlocks')}
          onMouseLeave={onClearHighlight}
        >
          <label
            htmlFor="process-missed-blocks"
            className="group/link flex h-10 cursor-pointer items-center gap-2.5 text-[13px] font-medium text-zinc-900 dark:text-zinc-100"
          >
            <input
              type="checkbox"
              id="process-missed-blocks"
              checked={processMissedBlocks}
              onChange={(e) => onProcessMissedBlocksChange(e.target.checked)}
              className="h-4 w-4 rounded-none accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="underline-offset-4 group-hover/link:underline">Process missed blocks</span>
          </label>
          <p className="ml-6.5 text-[12px] text-zinc-500 dark:text-zinc-400">
            Catch up on past blocks after a restart.
          </p>
        </div>
      </div>
    </details>
  );
}
