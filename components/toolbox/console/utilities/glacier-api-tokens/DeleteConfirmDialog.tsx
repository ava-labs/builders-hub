"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/toolbox/components/AlertDialog";
import { AlertTriangle } from "lucide-react";
import { ApiKeyListItem } from './types';

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    apiKey: ApiKeyListItem | null;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

export default function DeleteConfirmDialog({
    isOpen,
    apiKey,
    onConfirm,
    onCancel,
    isDeleting,
}: DeleteConfirmDialogProps) {
    if (!apiKey) return null;

    return (
        <AlertDialog open={isOpen} onOpenChange={onCancel}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        Delete API Key
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <p>
                                Are you sure you want to delete this API key? This action cannot be undone.
                            </p>

                            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3 space-y-2">
                                <div>
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Alias:</span>
                                    <span className="ml-2 font-mono text-zinc-900 dark:text-white">{apiKey.alias}</span>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Key ID:</span>
                                    <span className="ml-2 font-mono text-sm text-zinc-600 dark:text-zinc-400">{apiKey.keyId}</span>
                                </div>
                            </div>

                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    <strong>Warning:</strong> Any applications using this API key will immediately lose access to the Glacier API.
                                </p>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel} disabled={isDeleting}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete API Key'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
