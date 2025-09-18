import { Button } from "../../components/Button";

export const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => {

    const errorString = (typeof error.message === 'string' ? error.message : error.name || "Unknown error")
    const isTestnetError = errorString?.includes("The error is mostly returned when the client requests");

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="text-red-500 text-sm mb-4">
                {errorString}
            </div>
            {isTestnetError && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    This usually indicates that the Core wallet is not in testnet mode.
                    Open Settings → Advanced → Enable Testnet mode.
                </div>
            )}
            <Button onClick={resetErrorBoundary}>
                Try Again
            </Button>
        </div>
    );
};
