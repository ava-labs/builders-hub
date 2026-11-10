'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  MessageSquare,
  Minus,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, errorText, type BlueprintCard } from './api';
import { ComposerBeam } from './Beam';
import { CHAT_REFERENCE_EVENT } from './chat-reference';
import { Appear, Bone, Button, EmptyState, Notice, WorkingMark } from './ui';

/** Each tool's line in the work log once it is done, and while it runs (or when it was stopped or failed). */
const TOOL_LABELS: Record<string, { done: string; doing: string }> = {
  list_blueprints: { done: 'Read the blueprint catalog', doing: 'Reading the blueprint catalog' },
  read_blueprint: { done: 'Read blueprint', doing: 'Reading blueprint' },
  use_blueprint: { done: 'Added blueprint', doing: 'Adding blueprint' },
  list_files: { done: 'Listed files', doing: 'Listing files' },
  read_file: { done: 'Read', doing: 'Reading' },
  write_file: { done: 'Wrote', doing: 'Writing' },
  delete_file: { done: 'Deleted', doing: 'Deleting' },
  compile_and_audit: { done: 'Compiled and audited', doing: 'Compiling and auditing' },
  record_review: { done: 'Recorded the review', doing: 'Recording the review' },
  set_config: { done: 'Updated networks and parameters', doing: 'Updating networks and parameters' },
  propose_deployment: { done: 'Planned a testnet deployment', doing: 'Planning a testnet deployment' },
  propose_custom_deployment: { done: 'Planned a testnet deployment', doing: 'Planning a testnet deployment' },
  deployment_status: { done: 'Checked the deployment', doing: 'Checking the deployment' },
  promotion_status: { done: 'Checked promotion gates', doing: 'Checking promotion gates' },
  load_skill: { done: 'Loaded skill', doing: 'Loading skill' },
  frontend_context: { done: 'Read the frontend context', doing: 'Reading the frontend context' },
  registry_lookup: { done: 'Looked up the registry', doing: 'Looking up the registry' },
};

/** Starts for an empty chat in a project that has files. They fill the composer; nothing is sent until the builder sends it. */
const SUGGESTIONS = [
  'What does this project still need?',
  'Compile, audit and explain the findings.',
  'Plan a testnet deployment.',
];

/** Starts for a project with no files yet: the same build prompts as the Studio home's "Try" row. */
const buildStarters = (blueprints: Pick<BlueprintCard, 'level' | 'prompts'>[]) =>
  blueprints
    .filter((b) => b.level === 'advanced')
    .slice(0, 3)
    .map((b) => b.prompts[0])
    .filter(Boolean);

const PLACEHOLDER = 'Ask Studio to change, test, audit or deploy…';

/** A work log longer than this shows its newest steps and folds the rest behind one row. */
const LOG_TAIL = 4;

/** A running step shows how long it has taken once it passes this many seconds. */
const SHOW_ELAPSED_AFTER = 8;

/** The quiet tone of secondary text in the log and under the composer: a file path, a count, a note. */
const QUIET = 'text-zinc-500 dark:text-zinc-400';

/** One row of the work log. The standalone "Thinking" line uses the same box, so its text lands where a row's does. */
const ROW = 'flex w-full items-center gap-2.5 px-3 py-[7px] text-left font-mono text-[11px]';

type ToolPart = {
  type: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
};

const toolName = (part: ToolPart) => part.type.replace(/^tool-/, '');
const isRunning = (part: ToolPart) => part.state === 'input-streaming' || part.state === 'input-available';
const subjectOf = (part: ToolPart) =>
  String(part.input?.path ?? part.input?.id ?? part.input?.name ?? part.input?.blueprintId ?? '');

/**
 * The prose style of Studio's replies. The fumadocs prose rules give every `code` a rounded pill, the lines of a
 * code block included, so the code inside a block is reset and the block scrolls sideways on its own. The global
 * list rule paints bullets Avalanche red outside any layer, so only an important utility can set them back to zinc.
 */
const PROSE = [
  'prose prose-sm prose-zinc max-w-none break-words text-[14px] leading-relaxed dark:prose-invert',
  // A heading in a reply stays at the reply's size, so the column's hierarchy holds; table headers are not touched.
  '[&_:is(h1,h2,h3,h4)]:mb-2 [&_:is(h1,h2,h3,h4)]:mt-5 [&_:is(h1,h2,h3,h4)]:text-[14px] [&_:is(h1,h2,h3,h4)]:font-semibold',
  'prose-code:before:content-none prose-code:after:content-none [&_code]:rounded-none',
  'prose-pre:overflow-x-auto prose-pre:rounded-none prose-pre:border prose-pre:border-zinc-200 prose-pre:bg-zinc-50',
  'prose-pre:px-3 prose-pre:py-2.5 prose-pre:text-[12px] prose-pre:leading-relaxed prose-pre:text-zinc-800',
  'dark:prose-pre:border-zinc-800 dark:prose-pre:bg-zinc-900 dark:prose-pre:text-zinc-200',
  '[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[length:inherit]',
  '[&_ul>li]:marker:text-zinc-400! dark:[&_ul>li]:marker:text-zinc-500!',
].join(' ');

/** A table in a reply: square hairlines and mono labels, and it scrolls sideways on its own in a narrow column. */
const MARKDOWN: Components = {
  table: ({ children }) => (
    <div className="not-prose my-4 overflow-x-auto border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-[13px] leading-snug">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th
      style={style}
      className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left align-bottom font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td
      style={style}
      className="border-t border-zinc-200 px-3 py-2 align-top text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
    >
      {children}
    </td>
  ),
};

/** The builder's turn: a quiet tinted block, so it reads apart from Studio's plain prose. */
const USER_BLOCK = 'bg-zinc-100 px-4 py-3 dark:bg-zinc-800/60';

const clock = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

/** Seconds since this mounted, shown once a step runs long. Mount it with the step, so the clock starts with it. */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (seconds < SHOW_ELAPSED_AFTER) return null;
  return <span className={cn('shrink-0 tabular-nums', QUIET)}>{clock(seconds)}</span>;
}

/** The step Studio is on: the wave in the icon slot, the label in ink, and the clock where a done row has its chevron. */
function LiveRow({ label, subject }: { label: string; subject?: string }) {
  return (
    <div className={ROW}>
      <WorkingMark />
      <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-50">
        {label}
        {subject && <span className={QUIET}> {subject}</span>}
      </span>
      <Elapsed />
    </div>
  );
}

function ToolRow({ part, live, animate }: { part: ToolPart; live: boolean; animate: boolean }) {
  const [open, setOpen] = useState(false);
  const name = toolName(part);
  const labels = TOOL_LABELS[name];
  const subject = subjectOf(part);
  // A running step in a turn that is still live is the current step; in any other turn it never finished.
  const running = isRunning(part) && live;
  const stopped = isRunning(part) && !live;
  const failed =
    part.state === 'output-error' ||
    Boolean(part.output && typeof part.output === 'object' && 'error' in (part.output as object));
  const output =
    typeof part.output === 'string'
      ? part.output
      : part.output !== undefined
        ? JSON.stringify(part.output, null, 2)
        : part.errorText;

  const content = running ? (
    <LiveRow label={labels?.doing ?? name} subject={subject} />
  ) : (
    <>
      {stopped ? (
        <Minus className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
      ) : failed ? (
        <CircleAlert className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
      ) : (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
      <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
        {/* A step that did not finish reads as the attempt, not the result. */}
        {(stopped || failed ? labels?.doing : labels?.done) ?? name}
        {subject && <span className={QUIET}> {subject}</span>}
        {stopped && <span className={QUIET}> · stopped</span>}
        {failed && <span className="text-red-700 dark:text-red-300"> · failed</span>}
      </span>
      {output && (
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500',
            open && 'rotate-90',
          )}
        />
      )}
    </>
  );

  const row = (
    <div>
      {running ? (
        content
      ) : output ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(ROW, 'transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900')}
        >
          {content}
        </button>
      ) : (
        <div className={ROW}>{content}</div>
      )}
      {open && output && (
        <pre className="max-h-80 overflow-auto border-t border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
          {output.length > 20_000 ? `${output.slice(0, 20_000)}\n…` : output}
        </pre>
      )}
    </div>
  );
  return animate ? <Appear>{row}</Appear> : row;
}

/**
 * Consecutive tool calls as one hairline list, with the step that runs now as its last row. While the model thinks
 * between steps, a "Thinking" row stands in that place. A long run shows its newest steps; the rest open on request.
 */
function WorkLog({
  parts,
  live,
  animate,
  thinking,
}: {
  parts: ToolPart[];
  live: boolean;
  animate: boolean;
  thinking: boolean;
}) {
  const [all, setAll] = useState(false);
  const foldable = parts.length > LOG_TAIL + 1;
  const folded = foldable && !all ? parts.length - LOG_TAIL : 0;
  return (
    <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {foldable && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className={cn(
            ROW,
            QUIET,
            'transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
          )}
        >
          {all ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
          {all ? 'Hide earlier steps' : `${folded} earlier steps`}
        </button>
      )}
      {parts.slice(folded).map((part, i) => (
        <ToolRow key={part.toolCallId ?? folded + i} part={part} live={live} animate={animate} />
      ))}
      {thinking && (
        <Appear>
          <LiveRow label="Thinking" />
        </Appear>
      )}
    </div>
  );
}

type Segment = { kind: 'text'; key: string; text: string } | { kind: 'tools'; key: string; parts: ToolPart[] };

/** Text parts and runs of tool calls, in order. Step markers and reasoning are not shown and do not split a run. */
function segmentsOf(message: UIMessage): Segment[] {
  const segments: Segment[] = [];
  message.parts.forEach((part, i) => {
    if (part.type === 'text') {
      if (part.text) segments.push({ kind: 'text', key: `t${i}`, text: part.text });
      return;
    }
    if (!part.type.startsWith('tool-')) return;
    const tool = part as ToolPart;
    const previous = segments[segments.length - 1];
    if (previous?.kind === 'tools') previous.parts.push(tool);
    else segments.push({ kind: 'tools', key: `w${i}`, parts: [tool] });
  });
  return segments;
}

const FENCE = /```[\w-]*\n([\s\S]*?)\n?```/g;
const INLINE_CODE = /`([^`\n]+)`/g;

/** Inline `code` in the builder's words, set in mono; the rest stays as typed. */
function withInlineCode(text: string, keyPrefix: string) {
  return text.split(INLINE_CODE).map((piece, i) =>
    i % 2 ? (
      <code key={`${keyPrefix}${i}`} className="font-mono text-[12.5px]">
        {piece}
      </code>
    ) : (
      piece
    ),
  );
}

/**
 * The builder's words as typed. Code a reference brought from the editor (a fenced block) shows as code in a
 * small scrolling box, so a long selection does not take over the chat.
 */
function UserText({ text }: { text: string }) {
  const pieces: React.ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(FENCE)) {
    const before = text.slice(at, match.index).replace(/\n+$/, '');
    if (before) pieces.push(<p key={`p${at}`}>{withInlineCode(before, `p${at}-`)}</p>);
    pieces.push(
      <pre
        key={`c${at}`}
        className="max-h-48 overflow-auto border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {match[1]}
      </pre>,
    );
    at = (match.index ?? 0) + match[0].length;
  }
  const rest = text.slice(at).replace(/^\n+/, '');
  if (rest) pieces.push(<p key={`p${at}`}>{withInlineCode(rest, `p${at}-`)}</p>);
  return (
    <div className="flex flex-col gap-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-900 dark:text-zinc-50">
      {pieces}
    </div>
  );
}

function Message({
  message,
  live,
  animate,
  thinking,
}: {
  message: UIMessage;
  live: boolean;
  animate: boolean;
  /** The model is thinking after this turn's last step, so its log ends on a "Thinking" row. */
  thinking: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className={USER_BLOCK}>
        <span className="sr-only">You: </span>
        {message.parts.map((part, i) => (part.type === 'text' ? <UserText key={i} text={part.text} /> : null))}
      </div>
    );
  }
  const segments = segmentsOf(message);
  if (segments.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only">Studio: </span>
      {segments.map((segment, i) =>
        segment.kind === 'text' ? (
          <div key={segment.key} className={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>
              {segment.text}
            </ReactMarkdown>
          </div>
        ) : (
          <WorkLog
            key={segment.key}
            parts={segment.parts}
            live={live}
            animate={animate}
            thinking={thinking && i === segments.length - 1}
          />
        ),
      )}
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

/** The fixed-height line under the composer, so the chat above never shifts when the budget arrives. */
const USAGE_ROW = 'mt-2 flex h-4 min-w-0 items-center';

/**
 * The builder's chat budget under the composer. As either limit gets close, an amber dot leads the line and the
 * figure that is close turns amber; the rest stays quiet.
 */
function UsageLine({ usage }: { usage: Usage | null | undefined }) {
  if (usage === undefined)
    return (
      <div className={USAGE_ROW}>
        <Bone className="h-2.5 w-64 max-w-full" />
      </div>
    );
  if (usage === null) return <div className={USAGE_ROW} />;

  const limited = !usage.unlimited;
  const messagesTight = limited && usage.hourly.limit - usage.hourly.used <= 5;
  const tokensTight = limited && usage.daily.limit > 0 && usage.daily.used / usage.daily.limit >= 0.8;
  const tight = 'text-amber-700 dark:text-amber-300';
  const line = (of: string) => (
    <>
      <span className={cn(messagesTight && tight)}>
        {usage.hourly.used}
        {of}
        {usage.hourly.limit} messages this hour
      </span>
      {' · '}
      <span className={cn(tokensTight && tight)}>
        {compact(usage.daily.used)}
        {of}
        {compact(usage.daily.limit)} tokens today
      </span>
    </>
  );
  return (
    <p
      title={usage.unlimited ? 'Limits are off in local development.' : undefined}
      className={cn(USAGE_ROW, '@container gap-2 font-mono text-[10.5px]', QUIET)}
    >
      {(messagesTight || tokensTight) && (
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
      )}
      {/* A phone's column is too narrow for the words; the same figures fit with slashes. */}
      <span className="truncate @max-[22rem]:hidden">{line(' of ')}</span>
      <span className="hidden truncate @max-[22rem]:inline">{line('/')}</span>
    </p>
  );
}

/** The composer box. The loading frame renders the same box, disabled, so nothing moves when the chat arrives. */
function Composer({
  inputRef,
  value,
  onChange,
  onSubmit,
  busy = false,
  onStop,
  disabled = false,
  footer,
}: {
  inputRef?: React.Ref<HTMLTextAreaElement>;
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  busy?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  footer: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
      <ComposerBeam>
        <div className="flex items-end gap-2 bg-white px-3 py-2 dark:bg-zinc-950">
          <textarea
            ref={inputRef}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit?.();
              }
            }}
            rows={2}
            placeholder={PLACEHOLDER}
            aria-label="Message Studio"
            className="max-h-48 min-h-10 flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-wait dark:text-zinc-50"
          />
          {busy ? (
            <Button variant="secondary" onClick={onStop} aria-label="Stop">
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={disabled || !value.trim()} aria-label="Send">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </ComposerBeam>
      {footer}
    </div>
  );
}

/** A text line of the given width at the reply's line height, so the skeleton is as tall as what replaces it. */
const Line = ({ width, delay = 0, className }: { width: string; delay?: number; className?: string }) => (
  <span className="flex h-[22.75px] items-center">
    <Bone className={cn('h-3', width, className)} delay={delay} />
  </span>
);

/** The chat while its history loads: two turns in the shape of the real ones, and the composer where it will be. */
function HistorySkeleton({ usage }: { usage: Usage | null | undefined }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <span className="sr-only">Loading the chat</span>
      <div className="min-h-0 flex-1 overflow-hidden px-5 pb-3 pt-5">
        <div className="flex flex-col gap-6">
          <div className={USER_BLOCK}>
            <Line width="w-3/5" className="bg-zinc-200 dark:bg-zinc-700/60" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="border border-zinc-200 px-3 py-[9px] dark:border-zinc-800">
              <Bone className="h-2.5 w-2/5" delay={0.04} />
            </div>
            <div>
              <Line width="w-full" delay={0.08} />
              <Line width="w-11/12" delay={0.08} />
              <Line width="w-2/3" delay={0.08} />
            </div>
          </div>
          <div className={USER_BLOCK}>
            <Line width="w-2/5" delay={0.12} className="bg-zinc-200 dark:bg-zinc-700/60" />
          </div>
          <div>
            <Line width="w-full" delay={0.16} />
            <Line width="w-5/6" delay={0.16} />
            <Line width="w-1/2" delay={0.16} />
          </div>
        </div>
      </div>
      <Composer value="" disabled footer={<UsageLine usage={usage} />} />
    </div>
  );
}

function EmptyChat({ suggestions, onPick }: { suggestions: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        icon={MessageSquare}
        title="Tell Studio what to build or change"
        action={
          suggestions.length > 0 && (
            <div className="flex flex-col items-start gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onPick(suggestion)}
                  className="border border-zinc-200 px-2.5 py-1 text-left text-[13px] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )
        }
      />
      <p className={cn('font-mono text-[10.5px]', QUIET)}>Nothing reaches a mainnet from this chat.</p>
    </div>
  );
}

function Conversation({
  projectId,
  chatId,
  initialMessages,
  initialPrompt,
  suggestions,
  usage,
  onUsageStale,
  onTurnFinished,
}: {
  projectId: string;
  chatId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string;
  suggestions: string[];
  usage: Usage | null | undefined;
  onUsageStale: () => void;
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
  const { messages, sendMessage, regenerate, status, stop, error } = useChat({
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
  const lastTop = useRef(0);
  const sentInitial = useRef(false);
  // Messages that were already there when the chat opened arrive as one block; only new ones fade in one by one.
  const [historyIds] = useState(() => new Set(initialMessages.map((m) => m.id)));
  const busy = status === 'submitted' || status === 'streaming';
  const queued = Boolean(initialPrompt) && initialMessages.length === 0;
  const empty = messages.length === 0 && !queued;

  const nearBottom = (within: number) => {
    const el = scrollerRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight <= within;
  };
  // The follow pins the bottom at once. A smooth scroll would still be running when the reader scrolls up, and
  // would carry them back down.
  const scrollToBottom = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (initialPrompt && !sentInitial.current && initialMessages.length === 0) {
      sentInitial.current = true;
      void sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, initialMessages.length, sendMessage]);

  // Opening a chat lands on its last message before the first paint; after that, the bottom follows each change.
  // The scroller is watched too: when the column gets shorter, the last message stays in view.
  useLayoutEffect(() => {
    scrollToBottom();
    const content = contentRef.current;
    const scroller = scrollerRef.current;
    if (!content || !scroller) return;
    lastTop.current = scroller.scrollTop;
    const observer = new ResizeObserver(() => {
      if (following.current) scrollToBottom();
    });
    observer.observe(content);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // Any move up (wheel, touch, keys, scrollbar) stops the follow; reaching the bottom again resumes it. A shrinking
  // chat clamps the scroll position down, but it then sits at the bottom, so the follow holds. A wheel turned up
  // stops it at once, before its own scroll lands, so the next change does not pull the reader back.
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    following.current = nearBottom(8) || (following.current && el.scrollTop >= lastTop.current - 1);
    lastTop.current = el.scrollTop;
  };

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

  // The budget changes once the server has the message (streaming) and once the turn ends (ready or error).
  const lastStatus = useRef(status);
  useEffect(() => {
    if (status === lastStatus.current) return;
    lastStatus.current = status;
    if (status !== 'submitted') onUsageStale();
  }, [status, onUsageStale]);

  // Puts text in the composer (after what is there, or in its place) and the caret at its end. Uses only stable refs.
  const fillComposer = (text: string, append: boolean) => {
    setInput((current) => (append && current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
    requestAnimationFrame(() => {
      const el = composer.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      el.scrollTop = el.scrollHeight;
    });
  };

  // A code selection sent from the editor lands in the composer, ready for the instruction that goes with it.
  useEffect(() => {
    const onReference = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text) fillComposer(text, true);
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

  // A running step shows as the last row of its log. With none running, "Thinking" ends the log when the turn's
  // last segment is a log, and otherwise stands alone below the turn in a row's geometry.
  const runningTools =
    busy && last?.role === 'assistant'
      ? (last.parts as ToolPart[]).filter((p) => p.type.startsWith('tool-') && isRunning(p))
      : [];
  const lastSegments = last?.role === 'assistant' ? segmentsOf(last) : [];
  const idleThought = thinking && runningTools.length === 0;
  const thinkingInLog = idleThought && lastSegments[lastSegments.length - 1]?.kind === 'tools';
  const thinkingAlone = idleThought && !thinkingInLog;
  // Inside Studio's turn the line sits as close as its log rows; after the builder's message it starts the turn.
  const thinkingInTurn = lastSegments.length > 0;
  const current = runningTools[runningTools.length - 1];
  const statusText = current
    ? `${TOOL_LABELS[toolName(current)]?.doing ?? toolName(current)} ${subjectOf(current)}`.trim()
    : thinking
      ? 'Thinking'
      : '';

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
      {/* One live region that always exists, so a screen reader hears each new step. */}
      <p role="status" className="sr-only">
        {statusText}
      </p>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onWheel={(e) => {
          if (e.deltaY < 0) following.current = false;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-5"
      >
        {/* An empty chat sits on the composer, so its suggestions are next to the box they fill. */}
        <div ref={contentRef} className={cn(empty && 'flex min-h-full flex-col justify-end')}>
          <Appear>
            {empty ? (
              <EmptyChat suggestions={suggestions} onPick={(text) => fillComposer(text, false)} />
            ) : (
              <div className="flex flex-col gap-6">
                {messages.map((m, i) => {
                  const live = busy && i === messages.length - 1;
                  // A turn with nothing to show yet takes no slot, so the gap stays one gap.
                  if (m.role === 'assistant' && segmentsOf(m).length === 0) return null;
                  const fresh = !historyIds.has(m.id);
                  const message = <Message message={m} live={live} animate={fresh} thinking={live && thinkingInLog} />;
                  return fresh ? <Appear key={m.id}>{message}</Appear> : <div key={m.id}>{message}</div>;
                })}
                {thinkingAlone && (
                  <Appear className={cn('pl-px', thinkingInTurn && '-mt-3')}>
                    <LiveRow label="Thinking" />
                  </Appear>
                )}
                {cutOff && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      Studio stopped before writing its reply.
                    </span>
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
                  </div>
                )}
              </div>
            )}
          </Appear>
          {errorMessage && (
            <Appear className="mt-4 flex flex-col gap-3">
              <Notice tone="bad">
                <span className="line-clamp-4 break-words" title={errorMessage}>
                  {errorMessage}
                </span>
              </Notice>
              {/* The route keeps the builder's message once, so sending it again does not store it twice. */}
              <div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    following.current = true;
                    void regenerate();
                  }}
                >
                  Try again
                </Button>
              </div>
            </Appear>
          )}
        </div>
      </div>
      <Composer
        inputRef={composer}
        value={input}
        onChange={setInput}
        onSubmit={submit}
        busy={busy}
        onStop={() => void stop()}
        footer={<UsageLine usage={usage} />}
      />
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
  hasFiles,
  blueprints,
}: {
  projectId: string;
  chats: { id: string; title: string }[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  initialPrompt?: string;
  onTurnFinished: () => void;
  /** Whether the project has files. With none, an empty chat suggests build prompts instead of project questions. */
  hasFiles?: boolean;
  /** The blueprint catalog, for those build prompts. */
  blueprints?: Pick<BlueprintCard, 'level' | 'prompts'>[];
}) {
  const [history, setHistory] = useState<{ chatId: string; messages: UIMessage[] } | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // undefined while the first read is on its way, null when it failed.
  const [usage, setUsage] = useState<Usage | null | undefined>(undefined);
  // The queued prompt belongs to the chat the workspace opened on; a new chat made later must not send it again.
  const [promptChatId] = useState(activeChatId);
  // A chat this panel just made has no messages, so it opens empty at once instead of loading.
  const knownEmpty = useRef<string | null>(null);

  // The budget loads with the history, not after it, so its line is ready when the chat is.
  const loadUsage = useCallback(() => {
    api<Usage>('/api/studio/quota')
      .then(setUsage)
      .catch(() => setUsage((current) => current ?? null));
  }, []);
  useEffect(() => loadUsage(), [loadUsage]);

  useEffect(() => {
    if (!activeChatId) return;
    if (knownEmpty.current === activeChatId) {
      setHistoryError(null);
      setHistory((h) => (h?.chatId === activeChatId ? h : { chatId: activeChatId, messages: [] }));
      return;
    }
    knownEmpty.current = null;
    let cancelled = false;
    setHistory(null);
    setHistoryError(null);
    api<{ messages: UIMessage[] }>(`/api/studio/projects/${projectId}/chats/${activeChatId}`)
      .then((r) => !cancelled && setHistory({ chatId: activeChatId, messages: r.messages }))
      .catch((e) => !cancelled && setHistoryError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [projectId, activeChatId, reload]);

  const createChat = async () => {
    const { chat } = await api<{ chat: { id: string } }>(`/api/studio/projects/${projectId}/chats`, {
      method: 'POST',
      json: {},
    });
    knownEmpty.current = chat.id;
    return chat.id;
  };

  const newChat = async () => {
    setCreating(true);
    setError(null);
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

  const suggestions = useMemo(
    () => (hasFiles === false ? buildStarters(blueprints ?? []) : SUGGESTIONS),
    [hasFiles, blueprints],
  );
  const loaded = history !== null && history.chatId === activeChatId;
  const title = chats.find((c) => c.id === activeChatId)?.title ?? 'New chat';
  const canSwitch = chats.length > 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* On large screens the bottom rule and the title line up with the tab row on the right. */}
      <div className="flex h-[49px] shrink-0 items-center gap-1 border-b border-zinc-200 px-5 lg:pt-2 dark:border-zinc-800">
        {confirmDelete ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 dark:text-zinc-300">
              Delete this chat?
            </span>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void deleteChat()} busy={deleting}>
              Delete
            </Button>
          </>
        ) : (
          <>
            {/* The native select sits invisibly over the title, so the title sets the width and the chevron follows it. */}
            <div className="flex min-w-0 flex-1">
              <div className="group relative inline-flex min-w-0 max-w-full items-center gap-1.5">
                <span className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-800 group-hover:text-zinc-950 group-has-[select:focus-visible]:underline dark:text-zinc-100 dark:group-hover:text-white">
                  {title}
                </span>
                {canSwitch && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                <select
                  value={activeChatId ?? ''}
                  onChange={(e) => onSelectChat(e.target.value)}
                  disabled={!canSwitch}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
                  aria-label="Chat"
                >
                  {chats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-8 px-0"
              onClick={() => setConfirmDelete(true)}
              disabled={!activeChatId}
              aria-label="Delete chat"
              title="Delete chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {/* The negative margin puts the label, not its hit area, on the composer's right edge. */}
            <Button
              variant="ghost"
              className="-mr-3"
              onClick={() => void newChat()}
              busy={creating}
              aria-label="New chat"
            >
              {!creating && <Plus className="h-3.5 w-3.5" />} New
            </Button>
          </>
        )}
      </div>
      {error && (
        <div className="px-5 pt-4">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}
      {loaded ? (
        <Conversation
          key={history.chatId}
          projectId={projectId}
          chatId={history.chatId}
          initialMessages={history.messages}
          initialPrompt={history.chatId === promptChatId ? initialPrompt : undefined}
          suggestions={suggestions}
          usage={usage}
          onUsageStale={loadUsage}
          onTurnFinished={onTurnFinished}
        />
      ) : historyError ? (
        <Appear className="flex flex-col gap-3 px-5 pt-5">
          <Notice tone="bad">{historyError}</Notice>
          <div>
            <Button variant="secondary" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </Appear>
      ) : (
        <HistorySkeleton usage={usage} />
      )}
    </div>
  );
}
