"use client";

import { Button } from "../../../components/Button";

interface SuccessMessageProps {
    onReset: () => void;
    onClose: () => void;
}

export default function SuccessMessage({ onReset, onClose }: SuccessMessageProps) {
    return (
        <div className="space-y-4 mb-6 not-prose">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6">
                <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                        <svg className="h-8 w-8 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                            Node Created Successfully!
                        </h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            Your subnet has been registered with Builder Hub and your node is now running.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button 
                        onClick={onReset}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white !w-auto"
                    >
                        View Node
                    </Button>
                    <Button 
                        onClick={onClose}
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-600 dark:hover:bg-green-800 !w-auto"
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
