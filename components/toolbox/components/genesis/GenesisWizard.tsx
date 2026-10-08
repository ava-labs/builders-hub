'use client';

import { useState, useEffect, ReactNode, useCallback } from 'react';
import { JsonPreviewPanel } from './JsonPreviewPanel';
import { GenesisHighlightProvider, useGenesisHighlight } from './GenesisHighlightContext';
import { Settings2, FileJson, Upload, AlertCircle, CheckCircle2, Copy, Download } from 'lucide-react';

interface GenesisWizardProps {
  children: ReactNode;
  genesisData: string;
  onGenesisDataChange: (data: string) => void;
  currentStep?: number;
  footer?: ReactNode;
  embedded?: boolean;
}

type GenesisMode = 'builder' | 'custom';

// Mode toggle component
function ModeToggle({ mode, onModeChange }: { mode: GenesisMode; onModeChange: (mode: GenesisMode) => void }) {
  return (
    <div className="flex items-center border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => onModeChange('builder')}
        className={`flex h-8 items-center gap-2 px-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors ${
          mode === 'builder'
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-white text-zinc-500 hover:text-zinc-900 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
        }`}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Builder
      </button>
      <button
        type="button"
        onClick={() => onModeChange('custom')}
        className={`flex h-8 items-center gap-2 px-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors ${
          mode === 'custom'
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-white text-zinc-500 hover:text-zinc-900 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
        }`}
      >
        <FileJson className="h-3.5 w-3.5" />
        Custom JSON
      </button>
    </div>
  );
}

// JSON validation result
interface JsonValidation {
  valid: boolean;
  error?: string;
  size: number;
  hasRequiredFields: boolean;
  missingFields: string[];
}

function validateGenesisJson(json: string): JsonValidation {
  const result: JsonValidation = {
    valid: false,
    size: new Blob([json]).size,
    hasRequiredFields: false,
    missingFields: [],
  };

  if (!json || json.trim() === '') {
    result.error = 'Genesis JSON is required';
    return result;
  }

  try {
    const parsed = JSON.parse(json);
    result.valid = true;

    // Check for common required fields in Subnet-EVM genesis
    const requiredFields = ['config', 'alloc', 'gasLimit'];

    for (const field of requiredFields) {
      if (!(field in parsed) && !('config' in parsed && field in parsed.config)) {
        result.missingFields.push(field);
      }
    }

    // Check config sub-fields
    if (parsed.config) {
      if (!parsed.config.chainId) {
        result.missingFields.push('config.chainId');
      }
      if (!parsed.config.feeConfig) {
        result.missingFields.push('config.feeConfig');
      }
    }

    result.hasRequiredFields = result.missingFields.length === 0;
  } catch (e) {
    result.valid = false;
    result.error = (e as Error).message;
  }

  return result;
}

// Custom JSON Editor component
function CustomJsonEditor({
  value,
  onChange,
  validation,
}: {
  value: string;
  onChange: (value: string) => void;
  validation: JsonValidation;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          onChange(content);
        };
        reader.readAsText(file);
      }
    },
    [onChange],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          onChange(content);
        };
        reader.readAsText(file);
      }
    },
    [onChange],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'genesis.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [value]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch {
      // Can't format invalid JSON
    }
  }, [value, onChange]);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-start gap-3">
          <FileJson className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400" />
          <div className="space-y-1">
            <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">Custom Genesis JSON</div>
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Paste your pre-configured genesis JSON or drag & drop a genesis.json file. This is useful for importing
              configurations from other tools or deploying previously saved genesis files.
            </div>
          </div>
        </div>
      </div>

      {/* Drop zone / File upload */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border border-dashed p-6 text-center transition-colors ${
          isDragging
            ? 'border-zinc-900 bg-zinc-50/60 dark:border-zinc-300 dark:bg-zinc-900/40'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
        }`}
      >
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload
          className={`mx-auto mb-2 h-6 w-6 ${isDragging ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}
        />
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">genesis.json file</p>
      </div>

      {/* JSON Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Genesis JSON
          </label>
          <div className="flex items-center gap-2">
            {value && (
              <>
                <button
                  type="button"
                  onClick={handleFormat}
                  className="text-[11px] font-mono uppercase tracking-[0.1em] text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                  disabled={!validation.valid}
                >
                  Format
                </button>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.1em] text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.1em] text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              </>
            )}
          </div>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder='{"config": {"chainId": 12345, "feeConfig": {...}}, "alloc": {...}, "gasLimit": "0x..."}'
          className={`h-80 w-full resize-none border bg-zinc-950 px-4 py-3 font-mono text-[12px] text-zinc-100 transition-colors focus:outline-none ${
            value && !validation.valid
              ? 'border-red-500'
              : value && validation.valid
                ? 'border-emerald-500 dark:border-emerald-700'
                : 'border-zinc-800 focus:border-zinc-500'
          }`}
          spellCheck={false}
        />
      </div>

      {/* Validation status */}
      {value && (
        <div className="border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-start gap-2">
            {validation.valid ? (
              validation.hasRequiredFields ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              )
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              {validation.valid ? (
                <>
                  <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                    {validation.hasRequiredFields ? 'Valid Genesis JSON' : 'Valid JSON with warnings'}
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                    Size: {(validation.size / 1024).toFixed(2)} KiB
                    {validation.size > 64 * 1024 && (
                      <span className="ml-2 text-red-600 dark:text-red-400">(exceeds 64 KiB P-Chain limit!)</span>
                    )}
                  </div>
                  {!validation.hasRequiredFields && validation.missingFields.length > 0 && (
                    <div className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">
                      Missing recommended fields: {validation.missingFields.join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">Invalid JSON</div>
                  <div className="font-mono text-[12px] text-red-700 dark:text-red-400">{validation.error}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GenesisWizardContent({
  children,
  genesisData,
  onGenesisDataChange,
  footer,
  embedded = false,
}: GenesisWizardProps) {
  const { highlightPath } = useGenesisHighlight();
  const [isMobile, setIsMobile] = useState(false);
  const [mode, setMode] = useState<GenesisMode>('builder');
  const [customJson, setCustomJson] = useState('');

  // Sync customJson with genesisData when switching modes
  const handleModeChange = (newMode: GenesisMode) => {
    if (newMode === 'custom' && mode === 'builder') {
      // Switching to custom - populate with current genesis
      setCustomJson(genesisData);
    } else if (newMode === 'builder' && mode === 'custom') {
      // Switching back to builder - the builder will regenerate
      // Clear custom JSON to avoid confusion
    }
    setMode(newMode);
  };

  // When custom JSON changes, update genesis data
  const handleCustomJsonChange = (json: string) => {
    setCustomJson(json);
    // Only update parent if valid JSON
    try {
      JSON.parse(json);
      onGenesisDataChange(json);
    } catch {
      // Invalid JSON - don't update parent yet
    }
  };

  const validation = validateGenesisJson(customJson);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(embedded || window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [embedded]);

  if (isMobile) {
    // Mobile/Embedded layout
    return (
      <div className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex justify-center">
          <ModeToggle mode={mode} onModeChange={handleModeChange} />
        </div>

        {mode === 'builder' ? (
          <>
            <div className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">{children}</div>

            {genesisData && genesisData.length > 0 && !genesisData.startsWith('Error:') && (
              <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    Genesis JSON Preview
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {(new Blob([genesisData]).size / 1024).toFixed(2)} KiB
                  </span>
                </div>
                <div className="w-full overflow-x-auto">
                  <JsonPreviewPanel
                    jsonData={genesisData}
                    onJsonUpdate={onGenesisDataChange}
                    highlightPath={highlightPath || undefined}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <CustomJsonEditor value={customJson} onChange={handleCustomJsonChange} validation={validation} />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex flex-col border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Mode Toggle Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/60 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Genesis Configuration
        </span>
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      {mode === 'builder' ? (
        <div className="flex">
          {/* Left Panel - Configuration */}
          <div className="flex-1 p-5 bg-white dark:bg-zinc-950 text-[13px]">{children}</div>

          {/* Right Panel - JSON Preview */}
          <div className="w-[640px] xl:w-[720px] border-l border-zinc-200 dark:border-zinc-800 sticky top-4 self-start">
            <JsonPreviewPanel
              jsonData={genesisData}
              onJsonUpdate={onGenesisDataChange}
              highlightPath={highlightPath || undefined}
            />
          </div>
        </div>
      ) : (
        <div className="p-6">
          <CustomJsonEditor value={customJson} onChange={handleCustomJsonChange} validation={validation} />
        </div>
      )}

      {footer && (
        <div className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-4 py-3 flex items-center justify-center">{footer}</div>
        </div>
      )}
    </div>
  );
}

export function GenesisWizard({
  children,
  genesisData,
  onGenesisDataChange,
  currentStep: _currentStep = 1,
  footer,
  embedded = false,
}: GenesisWizardProps) {
  return (
    <GenesisHighlightProvider>
      <GenesisWizardContent
        genesisData={genesisData}
        onGenesisDataChange={onGenesisDataChange}
        footer={footer}
        embedded={embedded}
      >
        {children}
      </GenesisWizardContent>
    </GenesisHighlightProvider>
  );
}

interface WizardStepProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function WizardStep({ title, description, children }: WizardStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
