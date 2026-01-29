'use client';

import { Share2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ShareButtonProps {
  isShared: boolean;
  onClick: () => void;
  className?: string;
}

export function ShareButton({ isShared, onClick, className }: ShareButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "p-1 rounded hover:bg-white/10 transition-colors",
        isShared && "text-emerald-400",
        className
      )}
      title={isShared ? "Shared" : "Share"}
    >
      <Share2 className={cn(
        "w-4 h-4",
        isShared ? "text-emerald-400" : "text-zinc-400 hover:text-zinc-200"
      )} />
    </button>
  );
}
