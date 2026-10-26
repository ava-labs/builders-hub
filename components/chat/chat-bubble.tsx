'use client';

import { useState, useRef, useEffect } from 'react';
import { ASK_EVENT, getSelection } from '@/components/explorer-v2/dig/selection';
import { usePathname, useRouter } from 'next/navigation';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageSquare, X, Loader2, Minus, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type BubbleState = 'collapsed' | 'input' | 'expanded';

const bubbleTransport = new DefaultChatTransport({
  api: '/api/chat',
  body: { source: 'bubble' },
});

/* site-chat-bubble: the chat panel grows out of the corner its bubble sits in
   and folds back into it. The bubble grows to 1.04 on hover in 200ms and
   presses to 0.96 in 120ms, on the strong ease-out; its icon holds still. The
   panel grows from the bottom-right corner, from 8px lower at 96%, in 220ms.
   Closing, it folds back in 140ms and ignores the pointer meanwhile, then the
   bubble returns from 90% in 180ms. Under Reduce Motion nothing scales: the
   panel fades in 150ms and out 100ms, and the bubble fades back in 120ms.
   From the keyboard (Enter on the bubble; Escape, or Enter on close or
   minimize) the panel shows and goes at once, the bubble back at once with
   it: like the phone menu, a press from a control holding the keyboard focus
   moves nothing. The panel then takes none of these classes, so no fade
   plays either. Keyframes in app/global.css. The bubble's durations are set as
   transition-duration only: tailwindcss-animate makes duration-* set
   animation-duration too, which would stretch the bubble's return. */
const BUBBLE_MOTION = [
  'transition-[scale,box-shadow,border-color] [transition-duration:200ms] ease-out hover:scale-[1.04]',
  'active:scale-[0.96] active:[transition-duration:120ms] motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
].join(' ');
const BUBBLE_RETURN =
  'animate-[site-chat-return_180ms_var(--ease-out)] motion-reduce:animate-[vs-fade-in_120ms_var(--ease-out)]!';
const PANEL_MOTION = [
  'origin-bottom-right data-[state=closed]:pointer-events-none',
  'data-[state=open]:animate-[site-chat-in_220ms_var(--ease-out)]',
  'data-[state=closed]:animate-[site-chat-out_140ms_var(--ease-out)_forwards]',
  'motion-reduce:data-[state=open]:animate-[vs-fade-in_150ms_var(--ease-out)]!',
  'motion-reduce:data-[state=closed]:animate-[vs-fade-out_100ms_var(--ease-out)_forwards]!',
].join(' ');

/**
 * The collapsed bubble's gentle pulse, 2 s long: first 3 s after the bubble shows, then every `every` ms. The cleanup
 * (the panel opening, or the bubble leaving) also ends a pulse in progress: the pulse is an inline animation, so one
 * left on would replace the returning bubble's own animation.
 */
export function watchPulse(setPulse: (on: boolean) => void, every = 8000 + Math.random() * 4000): () => void {
  let end: ReturnType<typeof setTimeout> | undefined;
  const pulse = () => {
    setPulse(true);
    end = setTimeout(() => setPulse(false), 2000);
  };
  const first = setTimeout(pulse, 3000);
  const repeat = setInterval(pulse, every);
  return () => {
    clearTimeout(first);
    clearInterval(repeat);
    clearTimeout(end);
    setPulse(false);
  };
}

/** Whether a press came from the keyboard: the control it landed on holds the keyboard focus (the phone menu's test). */
export const fromKeyboard = (control: Element) => control.matches(':focus-visible');

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
  const router = useRouter();
  const [state, setState] = useState<BubbleState>('collapsed');
  const [inputValue, setInputValue] = useState('');
  const [shouldPulse, setShouldPulse] = useState(false);
  const [mounted, setMounted] = useState(false);
  // the open panel folding back into the corner: a full close clears the chat, a minimize keeps it
  const [closing, setClosing] = useState<'close' | 'minimize' | null>(null);
  // the bubble coming back after the panel folded away (never on the first paint)
  const [returning, setReturning] = useState(false);
  // the panel was opened, or is being closed, from the keyboard: it shows and goes at once
  const [instant, setInstant] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: 'chat-bubble',
    transport: bubbleTransport,
    onFinish() {
      setState('expanded');
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // the transport surfaces a failed request as its response body; the
  // route answers with JSON that carries a readable `message`
  const errorText = (() => {
    if (!error) return null;
    try {
      const body = JSON.parse(error.message);
      return typeof body?.message === 'string' ? body.message : error.message;
    } catch {
      return error.message || 'The chat did not answer. Try again.';
    }
  })();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Gentle pulse every 8-12 seconds when collapsed
  useEffect(() => (state === 'collapsed' && mounted ? watchPulse(setShouldPulse) : undefined), [state, mounted]);

  // A closing panel stays mounted until its exit animation ends (at once when
  // nothing animates), then the bubble returns. A full close clears the chat
  // only then, so the panel does not empty while it folds.
  useEffect(() => {
    if (!closing) return;
    let live = true;
    const exits = panelRef.current?.getAnimations() ?? [];
    Promise.allSettled(exits.map((animation) => animation.finished)).then(() => {
      if (!live) return;
      if (closing === 'close') {
        setMessages([]);
        setInputValue('');
      }
      setClosing(null);
      setState('collapsed');
      // closed from the keyboard, the bubble is back at once too
      setReturning(!instant);
    });
    return () => {
      live = false;
    };
  }, [closing, instant, setMessages]);

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

  // "Ask about this" on an explorer visual: open and send the question
  // with the selection attached
  useEffect(() => {
    const onAsk = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt;
      if (!prompt) return;
      setClosing(null);
      setReturning(false);
      setInstant(false);
      setState('expanded');
      sendMessage({ text: prompt }, { body: { page: { path: pathname, selection: getSelection()?.brief } } });
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, [pathname, sendMessage]);

  // Hide on /chat and /console pages, AFTER all hooks to avoid Rules of Hooks violation
  if (pathname.startsWith('/chat') || pathname.startsWith('/console')) {
    return null;
  }

  // On /stats and /explorer, hide the bubble on mobile via CSS: those pages
  // are dense (charts, tables, search results) and the floating button steals
  // tap targets. Desktop still shows it.
  const hideOnMobile =
    pathname.startsWith('/stats') || pathname.startsWith('/explorer');

  // The audits wizard (below md) and the auditor quote composer (below lg)
  // pin a full-width action bar to the bottom edge; lift the bubble above it
  // so it never covers the primary button at thumb reach. The profile save
  // bar reaches the bubble below xl.
  const liftForActionBar = pathname.startsWith('/audits/new')
    ? 'max-md:bottom-24'
    : pathname.startsWith('/audits/portal/requests/')
      ? 'max-lg:bottom-24'
      : pathname.startsWith('/profile')
        ? 'max-xl:bottom-24'
        : null;

  const handleBubbleClick = (bubble: Element) => {
    if (state === 'collapsed') {
      setInstant(fromKeyboard(bubble));
      setReturning(false);
      setState('input');
    }
  };

  // the page the visitor has open travels with every message, so the
  // assistant can explain what is on screen; the full chat inherits it
  const page = { path: pathname };
  // what the reader has picked out on the page (a run of txs on a gas
  // map, a range of blocks) rides along too, read at send time
  const pageWithSelection = () => ({ ...page, selection: getSelection()?.brief });
  const knowsPage = pathname.startsWith('/explorer') || pathname.startsWith('/docs') || pathname.startsWith('/academy');

  const handleOpenFullChat = () => {
    if (messages.length > 0) {
      sessionStorage.setItem('chat-bubble-messages', JSON.stringify(messages));
      sessionStorage.setItem('chat-bubble-page', JSON.stringify(page));
    }
    router.push('/chat');
  };

  // the panel folds back into the corner first (the effect above finishes the close); from the keyboard it goes at once
  const fold = (how: 'close' | 'minimize', byKey: boolean) => {
    if (state === 'collapsed' || closing) return;
    setInstant(byKey);
    setClosing(how);
  };

  const handleClose = (event: React.MouseEvent<HTMLElement>) => fold('close', fromKeyboard(event.currentTarget));

  const handleMinimize = (event: React.MouseEvent<HTMLElement>) => fold('minimize', fromKeyboard(event.currentTarget));

  const onSubmit = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue.trim() }, { body: { page: pageWithSelection() } });
    setInputValue('');
    setState('expanded');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') {
      fold('minimize', true);
    }
  };

  return (
    <div
      className={cn(
        'chatbot-container fixed bottom-6 right-6 z-50 flex-col items-end gap-3',
        hideOnMobile ? 'hidden md:flex' : 'flex',
        liftForActionBar,
      )}
      data-chatbot
    >
      {/* Collapsed bubble */}
      {state === 'collapsed' && (
        <button
          onClick={(event) => handleBubbleClick(event.currentTarget)}
          onAnimationEnd={() => setReturning(false)}
          aria-label="Open chat"
          className={cn(
            "group relative w-14 h-14 rounded-full shadow-lg border flex items-center justify-center hover:shadow-xl",
            BUBBLE_MOTION,
            returning && BUBBLE_RETURN,
            "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50",
            "hover:border-zinc-300 dark:hover:border-zinc-600",
          )}
          style={shouldPulse ? { animation: 'bubble-breathe 2s ease-in-out' } : undefined}
        >
          {/* Hover glow */}
          <div className="absolute inset-0 rounded-full bg-zinc-900/0 dark:bg-white/0 group-hover:bg-zinc-900/5 dark:group-hover:bg-white/5 transition-colors duration-150 ease-out" />

          <MessageSquare className="w-6 h-6 text-zinc-700 dark:text-zinc-300 relative z-10" />
        </button>
      )}

      {/* Input state */}
      {state === 'input' && (
        <div
          ref={panelRef}
          data-state={closing ? 'closed' : 'open'}
          className={cn(
            'w-[340px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden',
            instant ? undefined : PANEL_MOTION,
          )}
        >
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
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={knowsPage ? 'Ask about this page...' : 'Type your question...'}
              rows={2}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 dark:focus:ring-red-500/30 dark:focus:border-red-500/40 transition-[border-color,box-shadow]"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 text-center">Enter to send · Shift+Enter for new line · Esc to close</p>
          </div>
        </div>
      )}

      {/* Expanded chat */}
      {state === 'expanded' && (
        <div
          ref={panelRef}
          data-state={closing ? 'closed' : 'open'}
          className={cn(
            'w-[380px] h-[520px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden',
            instant ? undefined : PANEL_MOTION,
          )}
        >
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
                onClick={handleOpenFullChat}
                className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Open full chat"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
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
                  {isUser ? (
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      {text}
                    </div>
                  ) : (
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/50 overflow-hidden">
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-pre:overflow-x-auto prose-code:text-xs prose-headings:text-sm prose-headings:my-2 [overflow-wrap:anywhere]">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children, ...props }) => {
                              if (href === '/chat') {
                                return (
                                  <a
                                    {...props}
                                    href={href}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleOpenFullChat();
                                    }}
                                  >
                                    {children}
                                  </a>
                                );
                              }
                              return <a href={href} {...props}>{children}</a>;
                            },
                          }}
                        >
                          {text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {errorText && !isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 [overflow-wrap:anywhere]">
                  {errorText}
                </div>
              </div>
            )}

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
            <div className="relative flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={knowsPage ? 'Ask about this page...' : 'Type a message...'}
                rows={1}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/40 dark:focus:ring-red-500/30 dark:focus:border-red-500/40 transition-[border-color,box-shadow]"
              />
              {isLoading && (
                <div className="p-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
