'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { MessageSquare, X, ArrowUp, Loader2, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

type BubbleState = 'collapsed' | 'input' | 'expanded';

function getMessageText(message: UIMessage): string {
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text)
      .join('');
  }
  if ('content' in message && typeof (message as any).content === 'string') {
    return (message as any).content;
  }
  return '';
}

export function ChatBubble() {
  const pathname = usePathname();
  const [state, setState] = useState<BubbleState>('collapsed');
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: 'chat-bubble',
    onFinish() {
      setState('expanded');
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Hide on /chat pages — the full chat is already there
  if (pathname.startsWith('/chat')) {
    return null;
  }

  // Focus input when transitioning to input state
  useEffect(() => {
    if (state === 'input') {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [state]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleBubbleClick = () => {
    if (state === 'collapsed') {
      setState('input');
    }
  };

  const handleClose = () => {
    setState('collapsed');
    setMessages([]);
    setInputValue('');
  };

  const handleMinimize = () => {
    setState('collapsed');
  };

  const onSubmit = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;

    setState('expanded');
    sendMessage({ text: inputValue });
    setInputValue('');
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      if (messages.length === 0) {
        handleClose();
      } else {
        handleMinimize();
      }
    }
  };

  // Collapsed bubble
  if (state === 'collapsed') {
    return (
      <button
        onClick={handleBubbleClick}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'h-14 w-14 rounded-full',
          'bg-fd-primary text-fd-primary-foreground',
          'shadow-lg hover:shadow-xl',
          'flex items-center justify-center',
          'transition-all duration-300 ease-out',
          'hover:scale-105 active:scale-95',
          'cursor-pointer'
        )}
        aria-label="Open chat"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'bg-fd-background border border-fd-border',
        'rounded-xl shadow-2xl',
        'flex flex-col',
        'transition-all duration-300 ease-out',
        'overflow-hidden',
        state === 'input' && 'w-[25vw] min-w-[320px]',
        state === 'expanded' && 'w-[25vw] min-w-[320px] h-[50vh] min-h-[400px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fd-border bg-fd-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-fd-muted-foreground" />
          <span className="text-sm font-medium text-fd-foreground">Ask AI</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleMinimize}
              className="p-1.5 rounded-md hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors"
              aria-label="Minimize"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-fd-muted text-fd-muted-foreground hover:text-fd-foreground transition-colors"
            aria-label="Close chat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area — only shown in expanded state */}
      {state === 'expanded' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.map((message) => {
            const text = getMessageText(message);
            if (!text) return null;

            return (
              <div
                key={message.id}
                className={cn(
                  'text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'text-fd-foreground bg-fd-muted/50 rounded-lg px-3 py-2 ml-8'
                    : 'text-fd-foreground/90 pr-8'
                )}
              >
                <div className="whitespace-pre-wrap break-words">{text}</div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-center gap-2 text-fd-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-fd-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Avalanche..."
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm',
              'text-fd-foreground placeholder:text-fd-muted-foreground',
              'focus:outline-none',
              'max-h-[120px]'
            )}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'p-2 rounded-lg shrink-0',
              'bg-fd-primary text-fd-primary-foreground',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'hover:opacity-90 transition-opacity',
              'cursor-pointer'
            )}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
