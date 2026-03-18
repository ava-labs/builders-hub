"use client";

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/toolbox/components/AlertDialog";
import { Copy, Check } from "lucide-react";
import { CreateApiKeyResponse } from './types';
import { toast } from 'sonner';

interface ApiKeyCreatedModalProps {
    isOpen: boolean;
    onClose: () => void;
    createdKey: CreateApiKeyResponse | null;
}

export default function ApiKeyCreatedModal({
    isOpen,
    onClose,
    createdKey,
}: ApiKeyCreatedModalProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (createdKey?.key) {
            try {
                await navigator.clipboard.writeText(createdKey.key);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                toast.success('API key copied to clipboard');
            } catch (err) {
                // Fallback for older browsers
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = createdKey.key;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast.success('API key copied to clipboard');
                } catch (fallbackErr) {
                    toast.error('Failed to copy to clipboard');
                }
            }
        }
    };

    const handleClose = () => {
        setCopied(false);
        onClose();
    };

    if (!createdKey) return null;

    return (
        <AlertDialog open={isOpen} onOpenChange={handleClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>API Key Created</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-4">
                            <p className="text-sm">
                                Your API key has been created. Copy and store it securely - it won't be shown again.
                            </p>

                            <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                                <code className="flex-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all">
                                    {createdKey.key}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                                    aria-label="Copy API key"
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={handleClose}>Done</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
