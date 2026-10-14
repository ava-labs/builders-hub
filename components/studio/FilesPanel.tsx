'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileCode2, Maximize2, Plus, Upload } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { HighlighterGeneric } from 'shiki';
import { Board, BoardHeader, MUTED, SectionHeader } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { api, errorText, type ProjectOverview } from './api';
import { codeReference, referenceInChat } from './chat-reference';
import { SelectionMenu } from './SelectionMenu';
import { CodeSkeleton, CodeWorkbench, FileIcon, MAX_HIGHLIGHT_CHARS, langOf, loadHighlighter } from './CodeWorkbench';
import { ImportIntoProject } from './ImportProject';
import { Handoff } from './PublishSite';
import { Appear, Button, EmptyState, INPUT, Notice } from './ui';

type Token = { content: string; color?: string };

const plainLines = (text: string): Token[][] => text.split('\n').map((line) => [{ content: line }]);

/** The coloured lines and the clear textarea over them share these metrics, so the caret sits on the visible text. */
const CODE_TEXT =
  'font-mono text-[12px] leading-[20px] tracking-normal [font-kerning:none] [font-variant-ligatures:none] [tab-size:4]';
const GUTTER_TEXT = 'select-none pl-4 pr-4 text-right align-top font-mono text-[11px] leading-[20px]';
/** The gutter fits the widest line number: 16 px of padding each side and about 7 px a digit. */
const gutterWidth = (lines: number) => 32 + Math.max(2, String(lines).length) * 7;

export function FilesPanel({
  projectId,
  projectName,
  files,
  onChanged,
}: {
  projectId: string;
  projectName: string;
  files: ProjectOverview['files'];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(files[0]?.path ?? null);
  const [workbench, setWorkbench] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [newPath, setNewPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // A project that gets its first files while the tab is open opens the first one.
  useEffect(() => {
    if (selected === null && files.length > 0) setSelected(files[0].path);
  }, [files, selected]);

  const groups = useMemo(() => {
    const byFolder = new Map<string, ProjectOverview['files']>();
    for (const f of files) {
      const folder = f.path.split('/')[0];
      byFolder.set(folder, [...(byFolder.get(folder) ?? []), f]);
    }
    return [...byFolder];
  }, [files]);

  // Lines the builder selected in the read view, to send to the chat as a reference.
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const pickLines = (e: React.MouseEvent | React.KeyboardEvent) => {
    const sel = window.getSelection();
    const lineOf = (node: Node | null) =>
      Number(
        (node instanceof Element ? node : node?.parentElement)?.closest('tr[data-line]')?.getAttribute('data-line'),
      );
    if (!sel || sel.isCollapsed) {
      setPicked(null);
      setMenu(null);
      return;
    }
    const a = lineOf(sel.anchorNode);
    const b = lineOf(sel.focusNode);
    if (!a || !b) {
      setPicked(null);
      setMenu(null);
      return;
    }
    setPicked([Math.min(a, b), Math.max(a, b)]);
    if ('clientX' in e) setMenu({ x: e.clientX, y: e.clientY + 8 });
  };

  const sha = files.find((f) => f.path === selected)?.sha256;
  useEffect(() => {
    if (!selected) return;
    setContent(null);
    setDraft(null);
    setPicked(null);
    setMenu(null);
    setError(null);
    api<{ content: string }>(`/api/studio/projects/${projectId}/files?path=${encodeURIComponent(selected)}`)
      .then((r) => setContent(r.content))
      .catch((e) => setError(errorText(e)));
  }, [projectId, selected, sha]);

  // The read view uses the full-screen editor's highlighter; it shows plain text until the colours load.
  const { resolvedTheme } = useTheme();
  const [hl, setHl] = useState<HighlighterGeneric<string, string> | null>(null);
  useEffect(() => {
    void loadHighlighter()
      .then(setHl)
      .catch(() => {});
  }, []);
  const lang = selected ? langOf(selected) : null;
  const editing = draft !== null;
  const shown = draft ?? content;
  const rows = useMemo(() => {
    if (shown === null) return null;
    // In the read view a file's closing newline ends its last line. The editor keeps the empty line after it, where
    // the caret can go.
    const text = !editing && shown.endsWith('\n') ? shown.slice(0, -1) : shown;
    if (!hl || !lang || text.length > MAX_HIGHLIGHT_CHARS) return plainLines(text);
    try {
      const theme = resolvedTheme === 'dark' ? 'github-dark' : 'github-light';
      return hl
        .codeToTokens(text, { lang, theme })
        .tokens.map((line) => line.map((t): Token => ({ content: t.content, color: t.color })));
    } catch {
      return plainLines(text);
    }
  }, [shown, editing, hl, lang, resolvedTheme]);

  // Edit lays a clear textarea over the coloured lines, so the text, its colours and the scroll position hold still
  // and only a caret appears. iOS sets every console field to 16px, which would put that caret off the text, so there
  // the textarea shows its own text over the lines instead.
  const editor = useRef<HTMLTextAreaElement>(null);
  const [plainEdit, setPlainEdit] = useState(false);
  useEffect(() => setPlainEdit(CSS.supports('-webkit-touch-callout', 'none')), []);
  useLayoutEffect(() => {
    if (editing) editor.current?.focus({ preventScroll: true });
  }, [editing]);

  const save = async (path: string, text: string) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/studio/projects/${projectId}/files`, { method: 'PUT', json: { path, content: text } });
      setDraft(null);
      setSelected(path);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const slash = selected?.lastIndexOf('/') ?? -1;
  const gutter = gutterWidth(rows?.length ?? 0);

  return (
    <div className="flex flex-col gap-3">
      {workbench && (
        <CodeWorkbench
          projectId={projectId}
          projectName={projectName}
          files={files}
          initialPath={selected}
          onChanged={onChanged}
          onClose={() => setWorkbench(false)}
        />
      )}
      <SectionHeader
        label={files.length > 0 ? `Files · ${files.length}` : 'Files'}
        action={
          // An empty project has one action, in its empty state; the header holds them once files exist.
          (files.length > 0 || importing) && (
            <span className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setImporting((v) => !v)}
                aria-expanded={importing}
                title="Import a folder or a zip. Files at the same path are replaced with yours."
              >
                <Upload className="h-3.5 w-3.5" /> {importing ? 'Close import' : 'Import'}
              </Button>
              {files.length > 0 && (
                <Button variant="secondary" className="h-7" onClick={() => setWorkbench(true)} disabled={editing}>
                  <Maximize2 className="h-3.5 w-3.5" /> Full screen
                </Button>
              )}
            </span>
          )
        }
      />

      {importing && (
        <Appear>
          <Board className="border-x border-t border-zinc-200 dark:border-zinc-800">
            <BoardHeader label="Import files" />
            <div className="px-5 py-4 md:px-6">
              <ImportIntoProject projectId={projectId} onImported={onChanged} />
            </div>
          </Board>
        </Appear>
      )}

      {files.length === 0 ? (
        !importing && (
          <EmptyState
            icon={FileCode2}
            title="No files yet"
            action={
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <Upload className="h-3.5 w-3.5" /> Import files
              </Button>
            }
          >
            Ask Studio in the chat to write a contract, or import your own files.
          </EmptyState>
        )
      ) : (
        <div className="grid min-h-[60vh] grid-cols-1 border border-zinc-200 lg:grid-cols-[220px_minmax(0,1fr)] dark:border-zinc-800">
          {/* The rail is the tinted side; the code reads on the pane's own paper. */}
          <div className="flex flex-col border-b border-zinc-200 bg-zinc-100/60 lg:border-b-0 lg:border-r dark:border-zinc-800 dark:bg-zinc-900/40">
            {/* A div, not a nav: the site's global nav rules would pad the rows. */}
            <div className="flex flex-col py-2">
              {groups.map(([folder, list]) => (
                <div key={folder} className="flex flex-col pb-2">
                  <span className="px-4 pb-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {folder}
                  </span>
                  {list.map((f) => {
                    const current = f.path === selected;
                    return (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => setSelected(f.path)}
                        aria-current={current ? 'true' : undefined}
                        title={f.path}
                        className={cn(
                          'flex items-center gap-2 px-4 py-1.5 text-left font-mono text-[12px] transition-colors',
                          current
                            ? 'bg-zinc-200/80 text-zinc-900 shadow-[inset_2px_0_0_var(--color-zinc-900)] dark:bg-zinc-800 dark:text-zinc-50 dark:shadow-[inset_2px_0_0_var(--color-zinc-100)]'
                            : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
                        )}
                      >
                        <FileIcon path={f.path} className={current ? undefined : 'text-zinc-400 dark:text-zinc-500'} />
                        <span className="truncate">{f.path.slice(folder.length + 1)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <form
              className="mt-auto flex gap-1.5 border-t border-zinc-200 p-3 dark:border-zinc-800"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPath) return;
                void save(newPath, '');
                setNewPath('');
              }}
            >
              <input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="contracts/New.sol"
                aria-label="New file path"
                className={cn(INPUT, 'h-7 text-[11px]')}
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-7 w-7 px-0"
                aria-label="Create file"
                disabled={!newPath}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>

          <div className="flex min-w-0 flex-col dark:bg-zinc-950">
            {selected ? (
              <>
                <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 py-1.5 pl-4 pr-2 dark:border-zinc-800">
                  <span className="min-w-0 truncate font-mono text-[12px]" title={selected}>
                    <span className="text-zinc-400 dark:text-zinc-500">{selected.slice(0, slash + 1)}</span>
                    <span className="text-zinc-900 dark:text-zinc-50">{selected.slice(slash + 1)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {draft === null ? (
                      <>
                        {rows && (
                          <span className={cn(MUTED, 'mr-2 hidden text-[11px] sm:inline')}>
                            {rows.length} {rows.length === 1 ? 'line' : 'lines'}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setDraft(content ?? '')}
                          disabled={content === null}
                        >
                          Edit
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" className="h-7 px-2" onClick={() => setDraft(null)}>
                          Discard
                        </Button>
                        <Button className="h-7" onClick={() => void save(selected, draft)} busy={busy}>
                          Save
                        </Button>
                      </>
                    )}
                  </span>
                </div>
                {error && (
                  <div className="p-4">
                    <Notice tone="bad">{error}</Notice>
                  </div>
                )}
                {error && !editing ? null : (
                  <Handoff ready={rows !== null} skeleton={<CodeSkeleton />}>
                    {rows && (
                      <div
                        className="max-h-[70vh] overflow-auto"
                        onMouseUp={editing ? undefined : pickLines}
                        onKeyUp={editing ? undefined : pickLines}
                        onContextMenu={
                          editing
                            ? undefined
                            : (e) => {
                                pickLines(e);
                                if (!window.getSelection()?.isCollapsed) e.preventDefault();
                              }
                        }
                      >
                        <div className="relative w-max min-w-full py-3">
                          <table className={cn(CODE_TEXT, 'w-full border-collapse')}>
                            <tbody>
                              {rows.map((line, i) => (
                                <tr key={i} data-line={i + 1}>
                                  <td className={cn(MUTED, GUTTER_TEXT)} style={{ width: gutter, minWidth: gutter }}>
                                    {i + 1}
                                  </td>
                                  <td className="whitespace-pre pr-4 text-zinc-800 dark:text-zinc-200">
                                    {line.every((t) => !t.content)
                                      ? ' '
                                      : line.map((t, j) => (
                                          <span key={j} style={t.color ? { color: t.color } : undefined}>
                                            {t.content}
                                          </span>
                                        ))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {draft !== null && (
                            <textarea
                              ref={editor}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              spellCheck={false}
                              autoCapitalize="off"
                              autoComplete="off"
                              autoCorrect="off"
                              wrap="off"
                              aria-label={`Edit ${selected}`}
                              style={{ left: gutter }}
                              className={cn(
                                CODE_TEXT,
                                'absolute bottom-3 right-0 top-3 resize-none whitespace-pre border-0 p-0 pr-4 outline-none selection:bg-[#0061E2]/25',
                                // At 16px the longer lines pass the coloured layer's width, so the plain editor scrolls them.
                                plainEdit
                                  ? 'overflow-x-auto overflow-y-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'
                                  : 'overflow-hidden bg-transparent text-transparent caret-zinc-900 dark:caret-zinc-100',
                              )}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </Handoff>
                )}
              </>
            ) : (
              <p className="p-6 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">Select a file.</p>
            )}
          </div>
        </div>
      )}
      {menu && picked && selected && content !== null && (
        <SelectionMenu
          x={menu.x}
          y={menu.y}
          label={
            picked[0] === picked[1] ? `Ask Studio · line ${picked[0]}` : `Ask Studio · lines ${picked[0]}–${picked[1]}`
          }
          onClose={() => setMenu(null)}
          onPick={() => {
            const lines = content.split('\n');
            referenceInChat(
              codeReference(selected, picked[0], picked[1], lines.slice(picked[0] - 1, picked[1]).join('\n')),
            );
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}
