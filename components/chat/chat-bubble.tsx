'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { MessageSquare, X, ArrowUp, Loader2, Minus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

type BubbleState = 'collapsed' | 'input' | 'expanded';

const PROMPTS = [
  "Ask me anything... really anything",
  "Need help? I'm here for you",
  "Got questions? Let's chat",
  "Curious about something?",
  "I can help with that",
];

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
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [shouldBounce, setShouldBounce] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bounceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: 'chat-bubble',
    onFinish() {
      setState('expanded');
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Prevent hydration mismatch — only render dynamic content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide on /chat and /console pages
  if (pathname.startsWith('/chat') || pathname.startsWith('/console')) {
    return null;
  }

  // Bounce animation every 8-12 seconds when collapsed
  useEffect(() => {
    if (state !== 'collapsed' || !mounted) return;

    const triggerBounce = () => {
      setShouldBounce(true);
      setTimeout(() => setShouldBounce(false), 800);
    };

    const initialTimeout = setTimeout(triggerBounce, 3000);

    bounceIntervalRef.current = setInterval(() => {
      triggerBounce();
    }, 8000 + Math.random() * 4000);

    return () => {
      clearTimeout(initialTimeout);
      if (bounceIntervalRef.current) clearInterval(bounceIntervalRef.current);
    };
  }, [state, mounted]);

  // Show prompt tooltip periodically when collapsed
  useEffect(() => {
    if (state !== 'collapsed' || !mounted) return;

    const showPromptCycle = () => {
      setShowPrompt(true);
      setCurrentPrompt(prev => (prev + 1) % PROMPTS.length);

      promptTimeoutRef.current = setTimeout(() => {
        setShowPrompt(false);
        promptTimeoutRef.current = setTimeout(showPromptCycle, 10000 + Math.random() * 5000);
      }, 4000);
    };

    promptTimeoutRef.current = setTimeout(showPromptCycle, 5000);

    return () => {
      if (promptTimeoutRef.current) clearTimeout(promptTimeoutRef.current);
    };
  }, [state, mounted]);

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
      setShowPrompt(false);
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
    sendMessage({ text: inputValue.trim() });
    setInputValue('');
    setState('expanded');
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      setState('collapsed');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Prompt tooltip */}
      {mounted && (
        <div
          className={cn(
            "transform transition-all duration-500 ease-out",
            showPrompt && state === 'collapsed'
              ? "translate-y-0 opacity-100 scale-100"
              : "translate-y-2 opacity-0 scale-95 pointer-events-none"
          )}
        >
          <div className="relative bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white px-4 py-2.5 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-[220px]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              <p className="text-sm font-medium leading-snug">{PROMPTS[currentPrompt]}</p>
            </div>
            {/* Arrow pointing to bubble */}
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white dark:bg-zinc-900 border-r border-b border-zinc-200 dark:border-zinc-800 transform rotate-45" />
          </div>
        </div>
      )}

      {/* Collapsed bubble */}
      {state === 'collapsed' && (
        <button
          onClick={handleBubbleClick}
          className={cn(
            "group relative w-14 h-14 rounded-full shadow-lg border flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl",
            "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50",
            "hover:border-zinc-300 dark:hover:border-zinc-600",
            shouldBounce && "animate-bounce"
          )}
          style={shouldBounce ? { animationDuration: '0.8s', animationIterationCount: '2' } : undefined}
        >
          {/* Hover glow */}
          <div className="absolute inset-0 rounded-full bg-zinc-900/0 dark:bg-white/0 group-hover:bg-zinc-900/5 dark:group-hover:bg-white/5 transition-all duration-300" />

          {/* Pulse ring */}
          <div
            className="absolute inset-0 rounded-full animate-ping bg-zinc-400/20 dark:bg-zinc-500/20 opacity-0 group-hover:opacity-100"
            style={{ animationDuration: '2s' }}
          />

          <MessageSquare className="w-6 h-6 text-zinc-700 dark:text-zinc-300 relative z-10 transition-transform group-hover:scale-110" />
        </button>
      )}

      {/* Input state */}
      {state === 'input' && (
        <div className="w-[340px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center gap-2">
              <img src="/common-images/Avalanche_Logomark_Red.svg" alt="" className="w-4 h-4" />
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Ask me anything</span>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Input area */}
          <div className="p-3">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                rows={2}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-3 pr-12 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 dark:focus:ring-red-500/30 dark:focus:border-red-500/40 transition-all"
              />
              <button
                onClick={onSubmit}
                disabled={!inputValue.trim()}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-2 text-center">Press Enter to send, Esc to close</p>
          </div>
        </div>
      )}

      {/* Expanded chat */}
      {state === 'expanded' && (
        <div className="w-[380px] h-[520px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 shrink-0">
            <div className="flex items-center gap-2">
              <img src="/common-images/Avalanche_Logomark_Red.svg" alt="" className="w-4 h-4" />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Chat</span>
              {messages.length > 0 && (
                <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {messages.length} messages
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleMinimize}
                className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const text = getMessageText(message);
              const isUser = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                      isUser
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-md"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-md border border-zinc-200 dark:border-zinc-700/50"
                    )}
                  >
                    {text}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1.5">
                    <img
                      src="/common-images/Avalanche_Logomark_Black.svg"
                      alt=""
                      className="w-3.5 h-3.5 dark:hidden"
                      style={{ animation: 'bounce-gentle 1.4s ease-in-out infinite' }}
                    />
                    <img
                      src="/common-images/Avalanche_Logomark_Red.svg"
                      alt=""
                      className="w-3.5 h-3.5 hidden dark:block"
                      style={{ animation: 'bounce-gentle 1.4s ease-in-out infinite' }}
                    />
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/50 shrink-0">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-3 pr-12 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 dark:focus:ring-red-500/30 dark:focus:border-red-500/40 transition-all"
              />
              <button
                onClick={onSubmit}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
