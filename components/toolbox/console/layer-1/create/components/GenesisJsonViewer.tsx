import React, { useState, useCallback } from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { Copy, Download, AlertCircle, Edit, Lock } from 'lucide-react';
import { GenesisProgressBar } from './GenesisProgressBar';
import { ValidationMessages } from '@/components/toolbox/components/genesis/types';

interface GenesisJsonViewerProps {
    genesisData: string;
    chainName: string;
    isEditMode: boolean;
    onEditModeToggle: () => void;
    onGenesisDataChange: (data: string) => void;
    embedMode?: boolean;
    // For Create Chain button
    subnetId?: string;
    isCreatingChain?: boolean;
    onCreateChain?: () => void;
    // For validation messages
    validationMessages?: ValidationMessages;
}

export function GenesisJsonViewer({
    genesisData,
    chainName,
    isEditMode,
    onEditModeToggle,
    onGenesisDataChange,
    embedMode = false,
    subnetId,
    isCreatingChain,
    onCreateChain,
    validationMessages
}: GenesisJsonViewerProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyToClipboard = useCallback(async () => {
        if (!genesisData) return;
        try {
            await navigator.clipboard.writeText(genesisData);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy genesis data:", err);
        }
    }, [genesisData]);

    const handleDownloadGenesis = useCallback(() => {
        if (!genesisData) return;
        const blob = new Blob([genesisData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `genesis-${chainName || 'chain'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [genesisData, chainName]);

    const handleFormatJson = () => {
        try {
            const parsed = JSON.parse(genesisData);
            const formatted = JSON.stringify(parsed, null, 2);
            onGenesisDataChange(formatted);
        } catch (err) {
            // Can't format invalid JSON
        }
    };

    const validateJson = () => {
        try {
            JSON.parse(genesisData);
            return true;
        } catch {
            return false;
        }
    };

    if (embedMode) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                {/* Genesis Header */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Genesis JSON</h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                {isEditMode ? "Manual edit mode - form changes disabled" : "Live preview of your blockchain configuration"}
                            </p>
                        </div>
                        <div className="flex space-x-2">
                            <Button 
                                onClick={onEditModeToggle} 
                                variant={isEditMode ? "primary" : "secondary"}
                                size="sm"
                                className="flex items-center"
                            >
                                {isEditMode ? (
                                    <>
                                        <Lock className="h-4 w-4 mr-1" />
                                        Lock
                                    </>
                                ) : (
                                    <>
                                        <Edit className="h-4 w-4 mr-1" />
                                        Edit
                                    </>
                                )}
                            </Button>
                            <Button 
                                onClick={handleCopyToClipboard} 
                                variant="secondary" 
                                size="sm" 
                                disabled={!genesisData}
                                className="flex items-center"
                            >
                                <Copy className="h-4 w-4 mr-1" />
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button 
                                onClick={handleDownloadGenesis} 
                                variant="secondary" 
                                size="sm"
                                disabled={!genesisData}
                                className="flex items-center"
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                            </Button>
                        </div>
                    </div>
                </div>

                <GenesisProgressBar genesisData={genesisData} embedMode={true} />

                {/* Genesis JSON Content */}
                <div className="p-4">
                    {genesisData ? (
                        <>
                            {isEditMode && (
                                <div className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-3 py-2 rounded-md">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center">
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit mode active - form changes will not update JSON
                                    </p>
                                </div>
                            )}
                            <textarea
                                value={genesisData}
                                onChange={(e) => {
                                    if (isEditMode) {
                                        onGenesisDataChange(e.target.value);
                                    }
                                }}
                                readOnly={!isEditMode}
                                className={`w-full h-[500px] p-4 font-mono text-xs bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border rounded-lg resize-none focus:outline-none ${
                                    isEditMode 
                                        ? 'border-blue-500 dark:border-blue-400 focus:ring-2 focus:ring-blue-500 cursor-text' 
                                        : 'border-zinc-200 dark:border-zinc-700 cursor-default'
                                }`}
                                spellCheck={false}
                                style={{ tabSize: 2 }}
                                placeholder="Genesis JSON will appear here..."
                            />
                            <div className="mt-2 flex items-center space-x-2">
                                {validateJson() ? (
                                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Valid JSON
                                    </span>
                                ) : (
                                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Invalid JSON
                                    </span>
                                )}
                                {isEditMode && (
                                    <button
                                        onClick={handleFormatJson}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    >
                                        Format JSON
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="max-w-md">
                                {validationMessages && Object.keys(validationMessages.errors).length > 0 ? (
                                    <div className="text-left">
                                        <div className="flex items-center justify-center mb-4">
                                            <AlertCircle className="w-16 h-16 text-red-500/50" />
                                        </div>
                                        <h3 className="text-zinc-600 dark:text-zinc-400 font-medium text-center mb-4">
                                            Please fix the following errors:
                                        </h3>
                                        <div className="bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 p-4 rounded-md">
                                            <ul className="space-y-2 text-sm text-red-700 dark:text-red-400">
                                                {Object.entries(validationMessages.errors).map(([key, message]) => (
                                                    <li key={key} className="flex items-start">
                                                        <span className="text-red-500 mr-2">•</span>
                                                        <span>{message}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="text-zinc-400 dark:text-zinc-600 mb-2">
                                            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-zinc-600 dark:text-zinc-400 font-medium">No genesis configuration yet</p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                                            Configure your chain parameters to see the genesis JSON
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Console mode (two-panel layout)
    return (
        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col h-full">
            {/* Genesis Header */}
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Genesis JSON</h2>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {isEditMode ? "Manual edit mode - form changes disabled" : "Live preview of your blockchain configuration"}
                        </p>
                    </div>
                    <div className="flex space-x-2">
                        <Button 
                            onClick={onEditModeToggle} 
                            variant={isEditMode ? "primary" : "secondary"}
                            size="sm"
                            className="flex items-center"
                        >
                            {isEditMode ? (
                                <>
                                    <Lock className="h-4 w-4 mr-1" />
                                    Lock
                                </>
                            ) : (
                                <>
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                </>
                            )}
                        </Button>
                        <Button 
                            onClick={handleCopyToClipboard} 
                            variant="secondary" 
                            size="sm" 
                            disabled={!genesisData}
                            className="flex items-center"
                        >
                            <Copy className="h-4 w-4 mr-1" />
                            {copied ? "Copied!" : "Copy"}
                        </Button>
                        <Button 
                            onClick={handleDownloadGenesis} 
                            variant="secondary" 
                            size="sm"
                            disabled={!genesisData}
                            className="flex items-center"
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                        </Button>
                    </div>
                </div>
            </div>

            {/* Step 4: Create Chain Button */}
            {onCreateChain && (
                <div className="px-4 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold">
                            4
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Create Chain</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Deploy your blockchain</p>
                        </div>
                    </div>
                    <Button
                        onClick={onCreateChain}
                        loading={isCreatingChain}
                        loadingText="Creating Chain..."
                        disabled={!subnetId || !genesisData}
                        className="w-full h-9 text-sm"
                    >
                        Create Chain
                    </Button>
                    {(!subnetId || !genesisData) && (
                        <div className="mt-1 flex items-center justify-center text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {!subnetId ? "Configure a Subnet ID first" : "Configure genesis parameters"}
                        </div>
                    )}
                </div>
            )}

            <GenesisProgressBar genesisData={genesisData} embedMode={false} />

                {/* Genesis JSON Content */}
                <div className="flex-1 p-4 overflow-auto flex flex-col">
                {genesisData ? (
                    <div className="flex-1 flex flex-col">
                        {isEditMode && (
                            <div className="mb-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-3 py-2 rounded-md">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center">
                                    <Edit className="h-3 w-3 mr-1" />
                                    Edit mode active - form changes will not update JSON
                                </p>
                            </div>
                        )}
                        <textarea
                            value={genesisData}
                            onChange={(e) => {
                                if (isEditMode) {
                                    onGenesisDataChange(e.target.value);
                                }
                            }}
                            readOnly={!isEditMode}
                            className={`flex-1 w-full p-4 font-mono text-xs bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border rounded-lg resize-none focus:outline-none ${
                                isEditMode 
                                    ? 'border-blue-500 dark:border-blue-400 focus:ring-2 focus:ring-blue-500 cursor-text' 
                                    : 'border-zinc-200 dark:border-zinc-700 cursor-default'
                            }`}
                            spellCheck={false}
                            style={{ tabSize: 2 }}
                            placeholder="Genesis JSON will appear here..."
                        />
                        <div className="mt-2 flex items-center space-x-2">
                            {validateJson() ? (
                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Valid JSON
                                </span>
                            ) : (
                                <span className="text-xs text-red-600 dark:text-red-400 flex items-center">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Invalid JSON
                                </span>
                            )}
                            {isEditMode && (
                                <button
                                    onClick={handleFormatJson}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                >
                                    Format JSON
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="max-w-md">
                            {validationMessages && Object.keys(validationMessages.errors).length > 0 ? (
                                <div className="text-left">
                                    <div className="flex items-center justify-center mb-4">
                                        <AlertCircle className="w-16 h-16 text-red-500/50" />
                                    </div>
                                    <h3 className="text-zinc-600 dark:text-zinc-400 font-medium text-center mb-4">
                                        Please fix the following errors:
                                    </h3>
                                    <div className="bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 p-4 rounded-md">
                                        <ul className="space-y-2 text-sm text-red-700 dark:text-red-400">
                                            {Object.entries(validationMessages.errors).map(([key, message]) => (
                                                <li key={key} className="flex items-start">
                                                    <span className="text-red-500 mr-2">•</span>
                                                    <span>{message}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="text-zinc-400 dark:text-zinc-600 mb-2">
                                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-zinc-600 dark:text-zinc-400 font-medium">No genesis configuration yet</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                                        Configure your chain parameters to see the genesis JSON
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
