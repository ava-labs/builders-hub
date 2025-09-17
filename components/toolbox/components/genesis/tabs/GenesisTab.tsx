import { Copy, Download, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "../../Button";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

interface GenesisTabProps {
    genesisData: string;
    isEditingGenesis: boolean;
    editedGenesisData: string;
    copied: boolean;
    genesisSizeBytes: number;
    genesisSizeFormatted: string;
    genesisSizeStatus: {
        status: 'safe' | 'warning' | 'error';
        message: string;
        percentage: number;
    };
    setEditedGenesisData: (data: string) => void;
    handleCopyToClipboard: () => void;
    handleDownloadGenesis: () => void;
    handleEditGenesis: () => void;
    handleSaveGenesis: () => void;
    handleCancelEdit: () => void;
    isGenesisReady: boolean;
    setActiveTab: (tab: string) => void;
}

export function GenesisTab({
    genesisData,
    isEditingGenesis,
    editedGenesisData,
    copied,
    genesisSizeFormatted,
    genesisSizeStatus,
    setEditedGenesisData,
    handleCopyToClipboard,
    handleDownloadGenesis,
    handleEditGenesis,
    handleSaveGenesis,
    handleCancelEdit,
    isGenesisReady,
    setActiveTab
}: GenesisTabProps) {
    if (!isGenesisReady) {
        return (
            <div className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="text-center">
                    <p className="text-zinc-500 dark:text-zinc-400">Genesis JSON is not ready yet.</p>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">
                        Please complete the configuration and fix any validation errors.
                    </p>
                </div>
                <div className="flex justify-center">
                    <Button onClick={() => setActiveTab("config")} variant="secondary">
                        Back to Configuration
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-zinc-800 dark:text-white">Genesis JSON</h3>
                <div className="flex space-x-2">
                    {!isEditingGenesis ? (
                        <>
                            <Button 
                                onClick={handleCopyToClipboard} 
                                variant="secondary" 
                                size="sm" 
                                className="flex items-center"
                            >
                                <Copy className="h-4 w-4 mr-1" /> {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button 
                                onClick={handleDownloadGenesis} 
                                variant="secondary" 
                                size="sm" 
                                className="flex items-center"
                            >
                                <Download className="h-4 w-4 mr-1" /> Download
                            </Button>
                            <Button 
                                onClick={handleEditGenesis} 
                                variant="primary" 
                                size="sm" 
                                className="flex items-center"
                            >
                                Edit
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={handleCancelEdit} variant="secondary" size="sm">
                                Cancel
                            </Button>
                            <Button onClick={handleSaveGenesis} variant="primary" size="sm">
                                Save
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Genesis Size Information */}
            {genesisData && (
                <div className={`p-3 rounded-lg border ${
                    genesisSizeStatus.status === 'error' 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' 
                        : genesisSizeStatus.status === 'warning'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            {genesisSizeStatus.status === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            ) : genesisSizeStatus.status === 'warning' ? (
                                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            ) : (
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                            )}
                            <div>
                                <div className="flex items-center space-x-2">
                                    <span className={`text-sm font-medium ${
                                        genesisSizeStatus.status === 'error' 
                                            ? 'text-red-800 dark:text-red-200' 
                                            : genesisSizeStatus.status === 'warning'
                                            ? 'text-yellow-800 dark:text-yellow-200'
                                            : 'text-green-800 dark:text-green-200'
                                    }`}>
                                        File Size: {genesisSizeFormatted}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        genesisSizeStatus.status === 'error' 
                                            ? 'bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300' 
                                            : genesisSizeStatus.status === 'warning'
                                            ? 'bg-yellow-100 dark:bg-yellow-800/30 text-yellow-700 dark:text-yellow-300'
                                            : 'bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300'
                                    }`}>
                                        {genesisSizeStatus.percentage.toFixed(1)}% of P-Chain limit
                                    </span>
                                </div>
                                <p className={`text-xs mt-1 ${
                                    genesisSizeStatus.status === 'error' 
                                        ? 'text-red-700 dark:text-red-300' 
                                        : genesisSizeStatus.status === 'warning'
                                        ? 'text-yellow-700 dark:text-yellow-300'
                                        : 'text-green-700 dark:text-green-300'
                                }`}>
                                    {genesisSizeStatus.message}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-xs font-medium ${
                                genesisSizeStatus.status === 'error' 
                                    ? 'text-red-800 dark:text-red-200' 
                                    : genesisSizeStatus.status === 'warning'
                                    ? 'text-yellow-800 dark:text-yellow-200'
                                    : 'text-green-800 dark:text-green-200'
                            }`}>
                                P-Chain Limit: 64 KiB
                            </div>
                            <div className="mt-1 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                        genesisSizeStatus.status === 'error' 
                                            ? 'bg-red-500' 
                                            : genesisSizeStatus.status === 'warning'
                                            ? 'bg-yellow-500'
                                            : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(genesisSizeStatus.percentage, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!isEditingGenesis ? (
                <DynamicCodeBlock lang="json" code={genesisData} />
            ) : (
                <div className="space-y-2">
                    <textarea
                        value={editedGenesisData}
                        onChange={(e) => setEditedGenesisData(e.target.value)}
                        className="w-full h-96 p-3 text-sm font-mono bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                        placeholder="Enter your Genesis JSON here..."
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Edit the Genesis JSON directly. Make sure to maintain valid JSON syntax.
                    </p>
                </div>
            )}

            <div className="mt-4 flex justify-center space-x-4">
                <Button onClick={() => setActiveTab("config")} variant="secondary">
                    Back to Configuration
                </Button>
                <Button onClick={() => setActiveTab("precompiles")} variant="secondary">
                    View Precompile Info
                </Button>
                <Button onClick={() => setActiveTab("preinstalls")} variant="secondary">
                    View PreInstalls
                </Button>
            </div>
        </div>
    );
} 