import { cn } from "@/lib/utils";

/**
 * The Telegram mark. lucide ships no brand icons (the repo's other
 * "TelegramIcon" is a generic paper plane), so this is the real glyph, the
 * same path already inlined in components/chat/shared-chat-view.tsx.
 */
function TelegramMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.635z" />
    </svg>
  );
}

/**
 * A contact handle with the platform on the glyph rather than in the copy: the
 * bare "@handle" it replaces never said which service it belonged to. The
 * platform name still reaches a hover tooltip and a screen reader, so nothing
 * depends on recognising the mark.
 */
export function ContactHandle({ handle, className }: { handle: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`Telegram: ${handle}`}>
      <TelegramMark className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="sr-only">Telegram</span>
      {handle}
    </span>
  );
}
