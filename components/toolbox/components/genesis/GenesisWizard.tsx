"use client";

import { useState, useEffect, ReactNode, useCallback } from "react";
import { JsonPreviewPanel } from "./JsonPreviewPanel";
import { GenesisHighlightProvider, useGenesisHighlight } from "./GenesisHighlightContext";
import { Settings2, FileJson, Upload, AlertCircle, CheckCircle2, Copy, Download } from "lucide-react";

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
function ModeToggle({
    mode,
    onModeChange
}: {
    mode: GenesisMode;
    onModeChange: (mode: GenesisMode) => void;
}) {
    return (
        <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <button
                type="button"
                onClick={() => onModeChange('builder')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    mode === 'builder'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
                <Settings2 className="h-4 w-4" />
                Builder
            </button>
            <button
                type="button"
                onClick={() => onModeChange('custom')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    mode === 'custom'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
                <FileJson className="h-4 w-4" />
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
        missingFields: []
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
        const recommendedFields = ['chainId', 'timestamp'];

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
    validation
}: {
    value: string;
    onChange: (value: string) => void;
    validation: JsonValidation;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleDrop = useCallback((e: React.DragEvent) => {
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
    }, [onChange]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                onChange(content);
            };
            reader.readAsText(file);
        }
    }, [onChange]);

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
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <FileJson className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <div className="font-medium text-sm text-blue-800 dark:text-blue-200">
                            Custom Genesis JSON
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                            Paste your pre-configured genesis JSON or drag & drop a genesis.json file.
                            This is useful for importing configurations from other tools or deploying
                            previously saved genesis files.
                        </div>
                    </div>
                </div>
            </div>

            {/* Drop zone / File upload */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
            >
                <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className={`h-8 w-8 mx-auto mb-2 ${
                    isDragging ? 'text-blue-500' : 'text-zinc-400'
                }`} />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    genesis.json file
                </p>
            </div>

            {/* JSON Editor */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Genesis JSON
                    </label>
                    <div className="flex items-center gap-2">
                        {value && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleFormat}
                                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    disabled={!validation.valid}
                                >
                                    Format
                                </button>
                                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                >
                                    <Copy className="h-3 w-3" />
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
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
                    className={`w-full h-80 px-4 py-3 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg border font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        value && !validation.valid
                            ? 'border-red-500'
                            : value && validation.valid
                            ? 'border-green-500'
                            : 'border-zinc-700 dark:border-zinc-800'
                    }`}
                    spellCheck={false}
                />
            </div>

            {/* Validation status */}
            {value && (
                <div className={`rounded-lg p-3 ${
                    validation.valid
                        ? validation.hasRequiredFields
                            ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50'
                            : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50'
                        : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50'
                }`}>
                    <div className="flex items-start gap-2">
                        {validation.valid ? (
                            validation.hasRequiredFields ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            )
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-1">
                            {validation.valid ? (
                                <>
                                    <div className={`text-sm font-medium ${
                                        validation.hasRequiredFields
                                            ? 'text-green-800 dark:text-green-200'
                                            : 'text-amber-800 dark:text-amber-200'
                                    }`}>
                                        {validation.hasRequiredFields
                                            ? '✓ Valid Genesis JSON'
                                            : '⚠ Valid JSON with warnings'
                                        }
                                    </div>
                                    <div className={`text-xs ${
                                        validation.hasRequiredFields
                                            ? 'text-green-700 dark:text-green-300'
                                            : 'text-amber-700 dark:text-amber-300'
                                    }`}>
                                        Size: {(validation.size / 1024).toFixed(2)} KiB
                                        {validation.size > 64 * 1024 && (
                                            <span className="ml-2 text-red-600 dark:text-red-400">
                                                (exceeds 64 KiB P-Chain limit!)
                                            </span>
                                        )}
                                    </div>
                                    {!validation.hasRequiredFields && validation.missingFields.length > 0 && (
                                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                            Missing recommended fields: {validation.missingFields.join(', ')}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="text-sm font-medium text-red-800 dark:text-red-200">
                                        ✗ Invalid JSON
                                    </div>
                                    <div className="text-xs text-red-700 dark:text-red-300 font-mono">
                                        {validation.error}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function GenesisWizardContent({ children, genesisData, onGenesisDataChange, footer, embedded = false }: GenesisWizardProps) {
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
                        <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                            {children}
                        </div>

                        {genesisData && genesisData.length > 0 && !genesisData.startsWith("Error:") && (
                            <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Genesis JSON Preview</span>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
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
                    <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                        <CustomJsonEditor
                            value={customJson}
                            onChange={handleCustomJsonChange}
                            validation={validation}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Desktop layout
    return (
        <div className="flex flex-col bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {/* Mode Toggle Header */}
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Genesis Configuration
                </span>
                <ModeToggle mode={mode} onModeChange={handleModeChange} />
            </div>

            {mode === 'builder' ? (
                <div className="flex">
                    {/* Left Panel - Configuration */}
                    <div className="flex-1 p-5 bg-white dark:bg-zinc-950 text-[13px]">
                        {children}
                    </div>

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
                    <CustomJsonEditor
                        value={customJson}
                        onChange={handleCustomJsonChange}
                        validation={validation}
                    />
                </div>
            )}

            {footer && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-950/60">
                    <div className="px-4 py-3 flex items-center justify-center">
                        {footer}
                    </div>
                </div>
            )}
        </div>
    );
}

export function GenesisWizard({
    children,
    genesisData,
    onGenesisDataChange,
    currentStep = 1,
    footer,
    embedded = false
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
                <h2 className="text-lg font-semibold">{title}</h2>
                {description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
                )}
            </div>
            <div>{children}</div>
        </div>
    );
}
