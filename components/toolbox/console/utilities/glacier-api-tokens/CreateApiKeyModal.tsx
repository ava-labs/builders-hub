"use client";

import { useState } from 'react';
import { Button } from "@/components/toolbox/components/Button";
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
import { toast } from 'sonner';

interface CreateApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (alias: string) => Promise<void>;
    isCreating: boolean;
    maxKeysReached?: boolean;
}

export default function CreateApiKeyModal({
    isOpen,
    onClose,
    onSubmit,
    isCreating,
    maxKeysReached = false,
}: CreateApiKeyModalProps) {
    const [alias, setAlias] = useState('');

    const handleSubmit = async () => {
        if (!alias.trim()) {
            toast.error('Please enter an alias for your API key');
            return;
        }

        if (alias.length > 64) {
            toast.error('Alias must be 64 characters or less');
            return;
        }

        try {
            await onSubmit(alias.trim());
        } catch (err) {
            // Error is already handled by parent component
        }
    };

    const handleClose = () => {
        setAlias('');
        onClose();
    };

    if (maxKeysReached) {
        return (
            <AlertDialog open={isOpen} onOpenChange={handleClose}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Maximum API Keys Reached</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have reached the maximum number of API keys allowed. Please delete an existing key before creating a new one.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleClose}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={handleClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Create New API Key</AlertDialogTitle>
                    <AlertDialogDescription>
                        Enter a descriptive alias for your new API key. This will help you identify it later.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <label htmlFor="alias" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Alias
                        </label>
                        <input
                            id="alias"
                            type="text"
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder="e.g., Production API, Development, Testing..."
                            maxLength={64}
                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isCreating}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {alias.length}/64 characters
                        </p>
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleClose} disabled={isCreating}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleSubmit}
                        disabled={isCreating || !alias.trim()}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                        {isCreating ? 'Creating...' : 'Create API Key'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}