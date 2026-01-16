'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Check, Eye, Clock, Link as LinkIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

interface ShareInfo {
  shareToken: string;
  shareUrl: string;
  sharedAt: string;
  expiresAt: string | null;
  viewCount: number;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationTitle: string;
  isShared: boolean;
  shareToken?: string | null;
  sharedAt?: string | null;
  expiresAt?: string | null;
  viewCount?: number;
  onShareToggle: () => void;
}

// Expiration duration options (in days)
const EXPIRATION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

export function ShareModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle,
  isShared,
  shareToken,
  sharedAt,
  expiresAt,
  viewCount = 0,
  onShareToggle,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [selectedExpiration, setSelectedExpiration] = useState(30);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);

  // Initialize share info from props if already shared
  useEffect(() => {
    if (isShared && shareToken) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      setShareInfo({
        shareToken,
        shareUrl: `${baseUrl}/chat/share/${shareToken}`,
        sharedAt: sharedAt || new Date().toISOString(),
        expiresAt: expiresAt || null,
        viewCount: viewCount || 0,
      });
    } else {
      setShareInfo(null);
    }
  }, [isShared, shareToken, sharedAt, expiresAt, viewCount]);

  // Calculate days until expiration
  const getDaysUntilExpiration = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  const handleEnableSharing = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat-history/${conversationId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: selectedExpiration }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to enable sharing');
      }

      const data: ShareInfo = await res.json();
      setShareInfo(data);
      onShareToggle();
      toast.success('Sharing enabled! Link copied to clipboard.');

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error enabling sharing:', error);
      toast.error('Failed to enable sharing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSharing = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat-history/${conversationId}/share`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to stop sharing');
      }

      setShareInfo(null);
      setShowStopConfirmation(false);
      onShareToggle();
      toast.success('Sharing disabled. The link will no longer work.');
    } catch (error) {
      console.error('Error stopping sharing:', error);
      toast.error('Failed to stop sharing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareInfo) return;

    try {
      await navigator.clipboard.writeText(shareInfo.shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const daysRemaining = shareInfo ? getDaysUntilExpiration(shareInfo.expiresAt) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Share conversation
          </DialogTitle>
          <DialogDescription>
            {isShared
              ? 'Anyone with the link can view this conversation in read-only mode.'
              : 'Create a shareable link for this conversation.'}
          </DialogDescription>
        </DialogHeader>

        {!isShared && !shareInfo ? (
          // Not shared yet - show options
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Link expiration
              </label>
              <div className="flex gap-2">
                {EXPIRATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedExpiration(option.value)}
                    className={cn(
                      "flex-1 px-3 py-2 text-sm rounded-lg border transition-colors",
                      selectedExpiration === option.value
                        ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleEnableSharing}
              disabled={isLoading}
              className={cn(
                "w-full px-4 py-2.5 rounded-lg font-medium transition-colors",
                "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900",
                "hover:bg-zinc-700 dark:hover:bg-zinc-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating link...
                </span>
              ) : (
                'Create share link'
              )}
            </button>
          </div>
        ) : shareInfo ? (
          // Already shared - show link and stats
          <div className="space-y-4 py-4">
            {/* Share URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Share link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareInfo.shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>{shareInfo.viewCount} {shareInfo.viewCount === 1 ? 'view' : 'views'}</span>
              </div>
              {daysRemaining !== null && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>
                    {daysRemaining === 0
                      ? 'Expires today'
                      : `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Stop sharing */}
            {showStopConfirmation ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  Stop sharing? The link will no longer work and view count will be reset.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleStopSharing}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Stopping...' : 'Yes, stop sharing'}
                  </button>
                  <button
                    onClick={() => setShowStopConfirmation(false)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowStopConfirmation(true)}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Stop sharing
              </button>
            )}
          </div>
        ) : null}

        <DialogFooter className="sm:justify-start">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
