"use client";
import { Loader2, Download, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudioFooterProps {
  isExporting: boolean;
  copySuccess: boolean;
  onSave: () => void;
  onCopy: () => void;
}

export function StudioFooter({
  isExporting,
  copySuccess,
  onSave,
  onCopy,
}: StudioFooterProps) {
  return (
    <div className="px-5 py-3 border-t flex gap-3 shrink-0">
      <button
        type="button"
        onClick={onSave}
        disabled={isExporting}
        className={cn(
          "flex-1 h-12 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all",
          "bg-muted/50 hover:bg-muted border-2 border-border hover:border-foreground/20",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Save image
      </button>
      <button
        type="button"
        onClick={onCopy}
        disabled={isExporting}
        className={cn(
          "flex-1 h-12 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all",
          "bg-muted/50 hover:bg-muted border-2 border-border hover:border-foreground/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          copySuccess && "border-green-500 bg-green-500/10"
        )}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copySuccess ? "Copied!" : "Copy image"}
      </button>
    </div>
  );
}
