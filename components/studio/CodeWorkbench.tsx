'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, FileText, Minimize2, Plus, Search, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { HighlighterGeneric } from 'shiki';
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import { cn } from '@/lib/utils';
import { api, errorText, type ProjectOverview } from './api';
import { codeReference, referenceInChat } from './chat-reference';
import { SelectionMenu } from './SelectionMenu';
import { Button, INPUT, LABEL } from './ui';
import { useFullScreen } from './useFullScreen';

/*
 * The Files tab full screen, in the explorer's source-viewer layout and a code
 * editor's habits: a file tree, tabs with unsaved markers, a breadcrumb, a
 * gutter, syntax colours from the same highlighter the explorer uses, and a
 * status bar. Editing is a transparent textarea over the highlighted text, so
 * typing stays native (undo, selection, IME) and the colours follow along.
 */

const LANGS = ['solidity', 'javascript', 'jsx', 'html', 'css', 'json', 'markdown', 'xml'] as const;
const LANG_BY_EXT: Record<string, (typeof LANGS)[number]> = {
  sol: 'solidity',
  js: 'javascript',
  jsx: 'jsx',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  svg: 'xml',
};
const LANG_LABEL: Record<string, string> = {
  solidity: 'Solidity',
  javascript: 'JavaScript',
  jsx: 'React (JSX)',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  markdown: 'Markdown',
  xml: 'SVG',
};
/** Shared by the highlighted layer and the textarea over it: identical metrics keep the caret on the visible text. */
const CODE_METRICS =
  'font-mono text-[12.5px] leading-[20px] tracking-normal [font-variant-ligatures:none] [tab-size:4] [font-kerning:none]';

/** Above this, colours are skipped: re-highlighting on every keystroke would lag. */
const MAX_HIGHLIGHT_CHARS = 80_000;

let highlighter: Promise<HighlighterGeneric<string, string>> | null = null;
function loadHighlighter() {
  highlighter ??= import('shiki').then(({ createHighlighter }) =>
    createHighlighter({ themes: ['github-light', 'github-dark'], langs: [...LANGS] }),
  ) as Promise<HighlighterGeneric<string, string>>;
  return highlighter;
}

const langOf = (path: string) => LANG_BY_EXT[path.split('.').pop() ?? ''] ?? null;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type TreeNode = { name: string; path: string; children: TreeNode[]; file: boolean };

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [], file: false };
  for (const p of paths) {
    let node = root;
    p.split('/').forEach((part, i, parts) => {
      const path = parts.slice(0, i + 1).join('/');
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path, children: [], file: i === parts.length - 1 };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file ? 1 : -1))
      .map((n) => ({ ...n, children: sort(n.children) }));
  return sort(root.children);
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  return path.endsWith('.sol') || path.endsWith('.js') || path.endsWith('.jsx') ? (
    <FileCode2 className={cn('h-3.5 w-3.5 shrink-0', className)} />
  ) : (
    <FileText className={cn('h-3.5 w-3.5 shrink-0', className)} />
  );
}

export function CodeWorkbench({
  projectId,
  projectName,
  files,
  initialPath,
  onChanged,
  onClose,
}: {
  projectId: string;
  projectName: string;
  files: ProjectOverview['files'];
  initialPath: string | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const unsavedRef = useRef(0);
  const close = useCallback(
    (next: boolean) => {
      if (next) return;
      // Leaving native full screen can't be undone, but the editor stays open as an overlay if the builder keeps editing.
      if (unsavedRef.current > 0 && !window.confirm('Close the editor and discard unsaved changes?')) return;
      setOpen(false);
      onClose();
    },
    [onClose],
  );
  useFullScreen(shell, open, close);

  const { resolvedTheme } = useTheme();
  const [hl, setHl] = useState<HighlighterGeneric<string, string> | null>(null);
  useEffect(() => {
    void loadHighlighter()
      .then(setHl)
      .catch(() => {});
  }, []);

  const [tabs, setTabs] = useState<string[]>(initialPath ? [initialPath] : []);
  const [active, setActive] = useState<string | null>(initialPath);
  const [saved, setSaved] = useState<Record<string, { content: string; sha: string }>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [newPath, setNewPath] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [selection, setSelection] = useState<{ start: number; end: number; startLine: number; endLine: number } | null>(
    null,
  );
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  const shaOf = useCallback((path: string) => files.find((f) => f.path === path)?.sha256 ?? '', [files]);

  // Loads a file once per version; an unsaved draft is never overwritten by a reload.
  useEffect(() => {
    if (!active || saved[active]?.sha === shaOf(active)) return;
    let cancelled = false;
    api<{ content: string }>(`/api/studio/projects/${projectId}/files?path=${encodeURIComponent(active)}`)
      .then((r) => !cancelled && setSaved((s) => ({ ...s, [active]: { content: r.content, sha: shaOf(active) } })))
      .catch((e) => !cancelled && setStatus({ tone: 'bad', text: errorText(e) }));
    return () => {
      cancelled = true;
    };
  }, [active, projectId, saved, shaOf]);

  const openFile = (path: string) => {
    setTabs((t) => (t.includes(path) ? t : [...t, path]));
    setActive(path);
    setStatus(null);
  };

  const closeTab = (path: string) => {
    if (drafts[path] !== undefined && !window.confirm(`Discard unsaved changes to ${path}?`)) return;
    setDrafts(({ [path]: _gone, ...rest }) => rest);
    setTabs((t) => {
      const next = t.filter((p) => p !== path);
      if (active === path) setActive(next[Math.max(0, t.indexOf(path) - 1)] ?? null);
      return next;
    });
  };

  unsavedRef.current = Object.keys(drafts).filter((p) => drafts[p] !== saved[p]?.content).length;
  const text = active ? (drafts[active] ?? saved[active]?.content ?? null) : null;
  const dirty = !!active && drafts[active] !== undefined && drafts[active] !== saved[active]?.content;

  const save = useCallback(
    async (path: string, content: string) => {
      setBusy(true);
      try {
        await api(`/api/studio/projects/${projectId}/files`, { method: 'PUT', json: { path, content } });
        setDrafts(({ [path]: _done, ...rest }) => rest);
        setSaved((s) => ({ ...s, [path]: { content, sha: s[path]?.sha ?? '' } }));
        setStatus({ tone: 'ok', text: `Saved ${path}` });
        onChanged();
        return true;
      } catch (e) {
        setStatus({ tone: 'bad', text: errorText(e) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged, projectId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (active && dirty && text !== null) void save(active, text);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, dirty, save, text]);

  const createFile = async () => {
    const path = newPath?.trim();
    if (!path) return;
    if (await save(path, '')) {
      setNewPath(null);
      openFile(path);
    }
  };

  const lang = active ? langOf(active) : null;
  const html = useMemo(() => {
    if (text === null) return '';
    const source = text.endsWith('\n') ? `${text} ` : text;
    if (!hl || !lang || text.length > MAX_HIGHLIGHT_CHARS) return `<pre><code>${escapeHtml(source)}</code></pre>`;
    return hl.codeToHtml(source, { lang, theme: resolvedTheme === 'dark' ? 'github-dark' : 'github-light' });
  }, [hl, lang, text, resolvedTheme]);
  const lines = text === null ? 0 : text.split('\n').length;

  const trackCursor = () => {
    const el = editor.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const line = before.split('\n').length;
    setCursor({ line, col: el.selectionStart - before.lastIndexOf('\n') });
    if (el.selectionEnd > el.selectionStart) {
      const endLine = el.value.slice(0, el.selectionEnd).replace(/\n$/, '').split('\n').length;
      setSelection({
        start: el.selectionStart,
        end: el.selectionEnd,
        startLine: line,
        endLine: Math.max(line, endLine),
      });
    } else {
      setSelection(null);
      setMenu(null);
    }
  };

  /** The menu sits just under the pointer, on the selection, instead of in the header. */
  const openMenu = (e: { clientX: number; clientY: number; preventDefault?: () => void }, force: boolean) => {
    const el = editor.current;
    if (!el || el.selectionEnd <= el.selectionStart) {
      if (!force) setMenu(null);
      return;
    }
    if (force) e.preventDefault?.();
    setMenu({ x: e.clientX, y: e.clientY + 8 });
  };

  /**
   * Puts the selected lines (or the whole file) in the chat composer, then gets out of the way so the builder can say
   * what to change. The file is saved first: the agent edits what's stored, not an unsaved draft.
   */
  const askStudio = useCallback(async () => {
    const el = editor.current;
    if (!active || !el) return;
    const value = el.value;
    if (dirty && !(await save(active, value))) return;
    const start = selection?.start ?? 0;
    const end = selection?.end ?? value.length;
    const startLine = selection?.startLine ?? 1;
    const endLine = selection?.endLine ?? value.split('\n').length;
    referenceInChat(codeReference(active, startLine, endLine, value.slice(start, end)));
    close(false);
  }, [active, close, dirty, save, selection]);

  useEffect(() => setSelection(null), [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        void askStudio();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [askStudio]);

  const onEditorKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || !active) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const next = `${value.slice(0, start)}  ${value.slice(end)}`;
    setDrafts((d) => ({ ...d, [active]: next }));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  };

  const q = filter.trim().toLowerCase();
  const tree = useMemo(
    () => buildTree(files.map((f) => f.path).filter((p) => !q || p.toLowerCase().includes(q))),
    [files, q],
  );

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const pad = { paddingLeft: 12 + depth * 12 };
    if (node.file) {
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => openFile(node.path)}
          style={pad}
          className={cn(
            'flex w-full items-center gap-1.5 py-1 pr-3 text-left font-mono text-[12px]',
            node.path === active
              ? 'bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
          )}
        >
          <FileIcon path={node.path} />
          <span className="truncate">{node.name}</span>
          {drafts[node.path] !== undefined && drafts[node.path] !== saved[node.path]?.content && (
            <span className="ml-auto h-1.5 w-1.5 shrink-0 bg-zinc-900 dark:bg-zinc-100" aria-label="unsaved" />
          )}
        </button>
      );
    }
    const isCollapsed = !q && collapsed.has(node.path);
    return (
      <div key={node.path}>
        <button
          type="button"
          style={pad}
          onClick={() =>
            setCollapsed((c) => {
              const next = new Set(c);
              if (next.has(node.path)) next.delete(node.path);
              else next.add(node.path);
              return next;
            })
          }
          className="flex w-full items-center gap-1 py-1 pr-3 text-left font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {node.name}
        </button>
        {!isCollapsed && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div
      ref={shell}
      role="dialog"
      aria-modal
      aria-label={`${projectName} files`}
      className="fixed inset-0 z-[100] flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <AvalancheLogo width={18} height={16} aria-label="Avalanche" className="shrink-0" />
        <span className={LABEL}>{projectName} · files</span>
        <span className="flex-1" />
        {dirty && active && text !== null && (
          <Button className="h-7" busy={busy} onClick={() => void save(active, text)}>
            Save
          </Button>
        )}
        <Button variant="ghost" className="h-7 px-1.5" onClick={() => close(false)} title="Exit full screen (Esc)">
          <Minimize2 className="h-3.5 w-3.5" /> Exit
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex h-9 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
            <span className={cn(LABEL, 'flex-1')}>Explorer</span>
            <button
              type="button"
              onClick={() => setNewPath((p) => (p === null ? 'frontend/' : null))}
              aria-label="New file"
              title="New file"
              className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative border-b border-zinc-200 p-2 dark:border-zinc-800">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter files"
              className={cn(INPUT, 'h-7 pl-7 text-[11px]')}
            />
          </div>
          {newPath !== null && (
            <form
              className="flex gap-1 border-b border-zinc-200 p-2 dark:border-zinc-800"
              onSubmit={(e) => {
                e.preventDefault();
                void createFile();
              }}
            >
              <input
                autoFocus
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="contracts/New.sol"
                className={cn(INPUT, 'h-7 text-[11px]')}
              />
              <Button type="submit" variant="secondary" className="h-7 px-2" busy={busy}>
                Add
              </Button>
            </form>
          )}
          <nav className="min-h-0 flex-1 overflow-y-auto py-1">
            {tree.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[11px] text-zinc-400">No files{q ? ' match' : ''}.</p>
            ) : (
              tree.map((n) => renderNode(n, 0))
            )}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
            {tabs.map((path) => {
              const tabDirty = drafts[path] !== undefined && drafts[path] !== saved[path]?.content;
              return (
                <div
                  key={path}
                  onMouseDown={(e) => e.button === 1 && closeTab(path)}
                  className={cn(
                    'group flex shrink-0 items-center gap-1.5 border-r border-zinc-200 pl-3 pr-1.5 font-mono text-[12px] dark:border-zinc-800',
                    path === active
                      ? 'border-t-2 border-t-[#E6212F] bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50'
                      : 'border-t-2 border-t-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActive(path)}
                    className="flex items-center gap-1.5"
                    title={path}
                  >
                    <FileIcon path={path} />
                    {path.split('/').pop()}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeTab(path)}
                    aria-label={`Close ${path}`}
                    className="flex h-5 w-5 items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {tabDirty ? <span className="h-2 w-2 rounded-full bg-current group-hover:hidden" /> : null}
                    <X className={cn('h-3 w-3', tabDirty && 'hidden group-hover:block')} />
                  </button>
                </div>
              );
            })}
          </div>

          {active && (
            <div className="flex h-7 shrink-0 items-center gap-1 border-b border-zinc-200 px-4 font-mono text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {active.split('/').map((part, i, parts) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  <span className={i === parts.length - 1 ? 'text-zinc-900 dark:text-zinc-100' : undefined}>
                    {part}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="relative min-h-0 flex-1 overflow-auto">
            {!active ? (
              <p className="p-6 font-mono text-[12px] text-zinc-400">Open a file from the explorer.</p>
            ) : text === null ? (
              <p className="p-6 font-mono text-[12px] text-zinc-400">Loading…</p>
            ) : (
              <div className={cn('flex min-h-full min-w-max', CODE_METRICS)}>
                <div
                  aria-hidden
                  className="sticky left-0 z-10 select-none border-r border-zinc-200 bg-white py-3 pl-4 pr-3 text-right text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-600"
                >
                  {Array.from({ length: lines }, (_, i) => (
                    <div key={i} className={i + 1 === cursor.line ? 'text-zinc-900 dark:text-zinc-100' : undefined}>
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="relative flex-1">
                  <div
                    aria-hidden
                    className={cn(
                      'pointer-events-none px-4 py-3',
                      CODE_METRICS,
                      // Docs and highlighter styles give pre, code and .line their own sizes and spacing; any drift
                      // from the textarea above puts the caret away from the visible text.
                      '[&_*]:!m-0 [&_*]:!border-0 [&_*]:!p-0 [&_*]:![font:inherit] [&_*]:![letter-spacing:inherit] [&_*]:![tab-size:4]',
                      '[&_.line]:!inline [&_pre]:!whitespace-pre [&_pre]:!bg-transparent',
                    )}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  <textarea
                    ref={editor}
                    value={text}
                    onChange={(e) => setDrafts((d) => ({ ...d, [active]: e.target.value }))}
                    onKeyDown={onEditorKey}
                    onKeyUp={trackCursor}
                    onClick={trackCursor}
                    onSelect={trackCursor}
                    onMouseUp={(e) => openMenu(e, false)}
                    onContextMenu={(e) => openMenu(e, true)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    wrap="off"
                    aria-label={`Edit ${active}`}
                    className={cn(
                      'absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre border-0 bg-transparent px-4 py-3 text-transparent caret-zinc-900 outline-none selection:bg-[#0061E2]/25 dark:caret-zinc-100',
                      CODE_METRICS,
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-zinc-200 bg-zinc-50/80 px-4 font-mono text-[10.5px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            {status ? (
              <span className={status.tone === 'bad' ? 'text-red-600 dark:text-red-400' : undefined}>
                {status.text}
              </span>
            ) : (
              <span>{dirty ? 'Unsaved changes · ⌘S to save' : active ? 'Saved' : ''}</span>
            )}
            <span className="flex-1" />
            {active && (
              <>
                <span>
                  Ln {cursor.line}, Col {cursor.col}
                </span>
                <span>{lang ? LANG_LABEL[lang] : 'Plain text'}</span>
              </>
            )}
            <span>⌘L ask Studio · Esc to exit</span>
          </footer>
        </section>
      </div>
      {menu && selection && (
        <SelectionMenu
          x={menu.x}
          y={menu.y}
          label={
            selection.startLine === selection.endLine
              ? `Ask Studio · line ${selection.startLine}`
              : `Ask Studio · lines ${selection.startLine}–${selection.endLine}`
          }
          onClose={() => setMenu(null)}
          onPick={() => {
            setMenu(null);
            void askStudio();
          }}
        />
      )}
    </div>
  );
}
