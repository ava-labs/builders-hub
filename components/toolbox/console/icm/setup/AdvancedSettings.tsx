'use client';

import { Input } from '@/components/toolbox/components/Input';

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
      className="group border rounded-lg overflow-hidden bg-white dark:bg-zinc-950"
      open={showAdvancedSettings}
      onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Advanced Settings</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">(Optional)</span>
        </div>
        <svg
          className="w-5 h-5 transition-transform group-open:rotate-180 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="p-4 border-t space-y-4 bg-zinc-50 dark:bg-zinc-900/20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onFocus={() => onHighlight('logLevel')}
            onBlur={onClearHighlight}
            onMouseEnter={() => onHighlight('logLevel')}
            onMouseLeave={onClearHighlight}
          >
            <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Log Level</label>
            <select
              value={logLevel}
              onChange={(e) => onLogLevelChange(e.target.value as 'info' | 'debug' | 'warn' | 'error')}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="info">Info (recommended)</option>
              <option value="debug">Debug</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Controls verbosity of relayer logs</p>
          </div>

          <div
            onFocus={() => onHighlight('apiPort')}
            onBlur={onClearHighlight}
            onMouseEnter={() => onHighlight('apiPort')}
            onMouseLeave={onClearHighlight}
          >
            <Input
              label="API Port"
              value={apiPort.toString()}
              onChange={(value) => onApiPortChange(Number(value))}
              placeholder="8080"
              type="number"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Port for relayer API endpoints</p>
          </div>

          <div
            onFocus={() => onHighlight('storage')}
            onBlur={onClearHighlight}
            onMouseEnter={() => onHighlight('storage')}
            onMouseLeave={onClearHighlight}
          >
            <Input
              label="Storage Location"
              value={storageLocation}
              onChange={onStorageLocationChange}
              placeholder="./awm-relayer-storage"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Directory for relayer state storage</p>
          </div>

          <div
            className="flex flex-col justify-center"
            onMouseEnter={() => onHighlight('processMissedBlocks')}
            onMouseLeave={onClearHighlight}
          >
            <div className="flex items-center gap-2 h-10">
              <input
                type="checkbox"
                id="process-missed-blocks"
                checked={processMissedBlocks}
                onChange={(e) => onProcessMissedBlocksChange(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="process-missed-blocks"
                className="text-sm font-medium cursor-pointer text-zinc-700 dark:text-zinc-300"
              >
                Process Missed Blocks
              </label>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-6">Process historical blocks on restart</p>
          </div>
        </div>
      </div>
    </details>
  );
}
