'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Check, ChevronDown, ChevronRight, CircleAlert, Loader2, Plus, Square, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, errorText } from './api';
import { ComposerBeam } from './Beam';
import { CHAT_REFERENCE_EVENT } from './chat-reference';
import { Button, LABEL, Notice } from './ui';

const TOOL_LABELS: Record<string, string> = {
  list_blueprints: 'Read the blueprint catalog',
  read_blueprint: 'Read blueprint',
  use_blueprint: 'Added blueprint',
  list_files: 'Listed files',
  read_file: 'Read',
  write_file: 'Wrote',
  delete_file: 'Deleted',
  compile_and_audit: 'Compiled and audited',
  record_review: 'Recorded the review',
  set_config: 'Updated networks and parameters',
  propose_deployment: 'Planned a testnet deployment',
  deployment_status: 'Checked the deployment',
  promotion_status: 'Checked promotion gates',
  load_skill: 'Loaded skill',
  registry_lookup: 'Looked up the registry',
};

type ToolPart = {
  type: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
};

function ToolRow({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const name = part.type.replace(/^tool-/, '');
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const failed =
    part.state === 'output-error' ||
    (part.output && typeof part.output === 'object' && 'error' in (part.output as object));
  const subject = (part.input?.path ?? part.input?.id ?? part.input?.name ?? part.input?.blueprintId ?? '') as string;
  const output =
    typeof part.output === 'string'
      ? part.output
      : part.output !== undefined
        ? JSON.stringify(part.output, null, 2)
        : part.errorText;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        {running ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />
        ) : failed ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-zinc-700 dark:text-zinc-300">
          {TOOL_LABELS[name] ?? name}
          {subject && <span className="text-zinc-400 dark:text-zinc-500"> {subject}</span>}
        </span>
        {output && (
          <ChevronRight
            className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform', open && 'rotate-90')}
          />
        )}
      </button>
      {open && output && (
        <pre className="max-h-80 overflow-auto border-t border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          {output.length > 20_000 ? `${output.slice(0, 20_000)}\n…` : output}
        </pre>
      )}
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  const mine = message.role === 'user';
  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{mine ? 'You' : 'Studio'}</span>
      <div className="flex flex-col gap-2">
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            return mine ? (
              <p key={i} className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-900 dark:text-zinc-50">
                {part.text}
              </p>
            ) : (
              <div
                key={i}
                className="prose prose-sm prose-zinc max-w-none text-[14px] leading-relaxed dark:prose-invert prose-pre:rounded-none prose-pre:border prose-pre:border-zinc-200 prose-pre:bg-zinc-50 prose-pre:text-zinc-800 prose-code:before:content-none prose-code:after:content-none dark:prose-pre:border-zinc-800 dark:prose-pre:bg-zinc-900 dark:prose-pre:text-zinc-200"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
              </div>
            );
          }
          if (part.type.startsWith('tool-')) return <ToolRow key={i} part={part as ToolPart} />;
          return null;
        })}
      </div>
    </div>
  );
}

type Usage = {
  unlimited: boolean;
  hourly: { used: number; limit: number };
  daily: { used: number; limit: number };
};

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
    : n >= 1_000
      ? `${Math.round(n / 1_000)}k`
      : String(n);

/** The builder's chat budget under the composer, amber as either limit gets close. */
function UsageLine({ refreshKey }: { refreshKey: string }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<Usage>('/api/studio/quota')
      .then((u) => !cancelled && setUsage(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  if (!usage) return null;

  const messagesLeft = Math.max(0, usage.hourly.limit - usage.hourly.used);
  const tokenShare = usage.daily.limit > 0 ? usage.daily.used / usage.daily.limit : 0;
  const tight = !usage.unlimited && (messagesLeft <= 5 || tokenShare >= 0.8);
  return (
    <p
      className={cn(
        'mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px]',
        tight ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-400 dark:text-zinc-500',
      )}
    >
      <span>
        {usage.hourly.used} / {usage.hourly.limit} messages this hour
      </span>
      <span>
        {compact(usage.daily.used)} / {compact(usage.daily.limit)} tokens today
      </span>
      {usage.unlimited && <span className="text-zinc-400 dark:text-zinc-500">· limits off in local development</span>}
    </p>
  );
}

function Conversation({
  projectId,
  chatId,
  initialMessages,
  initialPrompt,
  onTurnFinished,
}: {
  projectId: string;
  chatId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string;
  onTurnFinished: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/studio/chat',
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { projectId, chatId: id, message: messages[messages.length - 1] },
        }),
      }),
    [projectId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: onTurnFinished,
  });
  const [input, setInput] = useState('');
  const composer = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Whether the reader is at the bottom; a builder who scrolled up to read is left alone.
  const following = useRef(true);
  const sentInitial = useRef(false);
  const busy = status === 'submitted' || status === 'streaming';

  const nearBottom = (within: number) => {
    const el = scrollerRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight <= within;
  };
  const scrollToBottom = (behavior: ScrollBehavior) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : behavior });
  };

  useEffect(() => {
    if (initialPrompt && !sentInitial.current && initialMessages.length === 0) {
      sentInitial.current = true;
      void sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, initialMessages.length, sendMessage]);

  // Opening a chat lands on its last message at once; after that, growth is followed smoothly.
  useEffect(() => {
    scrollToBottom('auto');
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (following.current) scrollToBottom('smooth');
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Builds, audits and file writes land during the turn; the tabs show them as each tool call finishes, not at the end.
  const finishedTools = busy
    ? (messages[messages.length - 1]?.parts ?? []).filter(
        (p) => p.type.startsWith('tool-') && (p as ToolPart).state === 'output-available',
      ).length
    : 0;
  const seenTools = useRef(0);
  useEffect(() => {
    if (finishedTools > seenTools.current) onTurnFinished();
    seenTools.current = finishedTools;
  }, [finishedTools, onTurnFinished]);

  // A code selection sent from the editor lands in the composer, ready for the instruction that goes with it.
  useEffect(() => {
    const onReference = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) return;
      setInput((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
      requestAnimationFrame(() => {
        const el = composer.current;
        if (!el) return;
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
        el.scrollTop = el.scrollHeight;
      });
    };
    window.addEventListener(CHAT_REFERENCE_EVENT, onReference);
    return () => window.removeEventListener(CHAT_REFERENCE_EVENT, onReference);
  }, []);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    following.current = true;
    void sendMessage({ text });
  };

  const last = messages[messages.length - 1];
  const lastVisible =
    last?.role === 'assistant'
      ? [...last.parts].reverse().find((p) => p.type === 'text' || p.type.startsWith('tool-'))
      : undefined;
  // Mid-turn the model can reason for a while between tool calls without streaming anything visible.
  const thinking =
    status === 'submitted' ||
    (status === 'streaming' && last?.role === 'assistant' && last.parts[last.parts.length - 1]?.type !== 'text');
  const cutOff = !busy && !error && last?.role === 'assistant' && lastVisible?.type !== 'text';

  const errorMessage = (() => {
    if (!error) return null;
    try {
      return JSON.parse(error.message).message ?? error.message;
    } catch {
      return error.message;
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={() => {
          if (nearBottom(8)) following.current = true;
        }}
        onWheel={(e) => {
          following.current = e.deltaY < 0 ? false : nearBottom(96);
        }}
        onTouchMove={() => {
          following.current = nearBottom(48);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-5"
      >
        <div ref={contentRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <p>
                Tell Studio what to build. It picks blueprints, writes contracts and tests, compiles and audits, and
                plans a testnet deployment you sign.
              </p>
              <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                Nothing reaches a mainnet from this chat.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
              {thinking && (
                <span className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </span>
              )}
              {cutOff && (
                <Notice tone="warn">
                  <span className="flex flex-wrap items-center gap-3">
                    <span>Studio stopped before writing its reply.</span>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        following.current = true;
                        void sendMessage({
                          text: 'Continue: write up what you found from the steps above before changing anything.',
                        });
                      }}
                    >
                      Continue
                    </Button>
                  </span>
                </Notice>
              )}
            </div>
          )}
          {errorMessage && (
            <div className="mt-4">
              <Notice tone="bad">{errorMessage}</Notice>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <ComposerBeam>
          <div className="flex items-end gap-2 bg-white px-3 py-2 dark:bg-zinc-950">
            <textarea
              ref={composer}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Ask for a change, a test, an audit, or a deployment…"
              className="max-h-48 min-h-10 flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            />
            {busy ? (
              <Button variant="secondary" onClick={() => stop()} aria-label="Stop">
                <Square className="h-3 w-3" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!input.trim()} aria-label="Send">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </ComposerBeam>
        <UsageLine refreshKey={`${messages.length}:${status}`} />
      </div>
    </div>
  );
}

export function ChatPanel({
  projectId,
  chats,
  activeChatId,
  onSelectChat,
  initialPrompt,
  onTurnFinished,
}: {
  projectId: string;
  chats: { id: string; title: string }[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  initialPrompt?: string;
  onTurnFinished: () => void;
}) {
  const [history, setHistory] = useState<{ chatId: string; messages: UIMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    setHistory(null);
    api<{ messages: UIMessage[] }>(`/api/studio/projects/${projectId}/chats/${activeChatId}`)
      .then((r) => !cancelled && setHistory({ chatId: activeChatId, messages: r.messages }))
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [projectId, activeChatId]);

  const createChat = async () => {
    const { chat } = await api<{ chat: { id: string } }>(`/api/studio/projects/${projectId}/chats`, {
      method: 'POST',
      json: {},
    });
    return chat.id;
  };

  const newChat = async () => {
    setCreating(true);
    try {
      const id = await createChat();
      onTurnFinished();
      onSelectChat(id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setCreating(false);
    }
  };

  const deleteChat = async () => {
    if (!activeChatId) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/api/studio/projects/${projectId}/chats/${activeChatId}`, { method: 'DELETE' });
      const remaining = chats.filter((c) => c.id !== activeChatId);
      onSelectChat(remaining[0]?.id ?? (await createChat()));
      onTurnFinished();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-5 py-2 dark:border-zinc-800">
        {confirmDelete ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-700 dark:text-zinc-300">
              Delete this chat and its messages?
            </span>
            <Button variant="danger" onClick={() => void deleteChat()} busy={deleting}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {/* appearance-none drops the browser's own inner padding, which otherwise indents the title from the edge. */}
            <div className="relative min-w-0 flex-1">
              <select
                value={activeChatId ?? ''}
                onChange={(e) => onSelectChat(e.target.value)}
                className="h-7 w-full min-w-0 appearance-none truncate rounded-none border-none bg-transparent p-0 pr-5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 outline-none focus-visible:underline dark:text-zinc-200"
                aria-label="Chat"
              >
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            </div>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={!activeChatId}
              aria-label="Delete chat"
              title="Delete chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" onClick={() => void newChat()} busy={creating} aria-label="New chat">
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </>
        )}
      </div>
      {error && (
        <div className="p-4">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}
      {history && history.chatId === activeChatId ? (
        <Conversation
          key={history.chatId}
          projectId={projectId}
          chatId={history.chatId}
          initialMessages={history.messages}
          initialPrompt={initialPrompt}
          onTurnFinished={onTurnFinished}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        </div>
      )}
    </div>
  );
}
