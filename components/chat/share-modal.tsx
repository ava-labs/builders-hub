'use client';

import { useState, useEffect, useCallback } from 'react';
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
import posthog from 'posthog-js';

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

export function ShareModal({
  isOpen,
  onClose,
  conversationId,
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
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);

  // Enable sharing and get URL
  const enableSharing = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat-history/${conversationId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 7 }), // Default: 7 days
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to enable sharing');
      }

      const data: ShareInfo = await res.json();
      setShareInfo(data);
      onShareToggle();

      // Track share event
      posthog.capture('ai_chat_shared', {
        conversation_id: conversationId,
        expires_in_days: 7,
      });

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error enabling sharing:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onShareToggle]);

  // Initialize share info from props OR auto-enable sharing
  useEffect(() => {
    if (!isOpen) return;

    if (isShared && shareToken) {
      // Already shared - show existing info
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
      setShareInfo({
        shareToken,
        shareUrl: `${baseUrl}/chat/share/${shareToken}`,
        sharedAt: sharedAt || new Date().toISOString(),
        expiresAt: expiresAt || null,
        viewCount: viewCount || 0,
      });
    } else {
      // Not shared yet - auto-enable sharing
      setShareInfo(null);
      enableSharing();
    }
  }, [isOpen, isShared, shareToken, sharedAt, expiresAt, viewCount, enableSharing]);

  // Calculate days until expiration
  const getDaysUntilExpiration = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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
      toast.success('Sharing disabled');
      onClose();
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
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
            Anyone with the link can view this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading && !shareInfo ? (
            // Loading state
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : shareInfo ? (
            // Show share link
            <>
              {/* Share URL with copy button */}
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
                    "p-2.5 rounded-lg transition-colors",
                    copied
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
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
                    Stop sharing? The link will no longer work.
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
                  className="text-sm text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Stop sharing
                </button>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-start">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
