'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileCode2, FileText, Maximize2, Plus } from 'lucide-react';
import { Board, BoardHeader, EmptyRow, MUTED } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { api, errorText, type ProjectOverview } from './api';
import { codeReference, referenceInChat } from './chat-reference';
import { SelectionMenu } from './SelectionMenu';
import { CodeWorkbench } from './CodeWorkbench';
import { ImportIntoProject } from './ImportProject';
import { Button, INPUT, Notice } from './ui';

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
    api<{ content: string }>(`/api/studio/projects/${projectId}/files?path=${encodeURIComponent(selected)}`)
      .then((r) => setContent(r.content))
      .catch((e) => setError(errorText(e)));
  }, [projectId, selected, sha]);

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

  return (
    <div className="flex flex-col gap-4">
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
      <div className="flex items-center justify-end">
        <Button variant="secondary" onClick={() => setWorkbench(true)} disabled={draft !== null}>
          <Maximize2 className="h-3.5 w-3.5" /> Full screen editor
        </Button>
      </div>
      <Board>
        <BoardHeader
          label="Bring in your latest work"
          action={
            <Button variant="ghost" className="h-6 px-1" onClick={() => setImporting((v) => !v)}>
              {importing ? 'Close' : 'Import files'}
            </Button>
          }
        />
        {importing ? (
          <div className="px-5 py-4 md:px-6">
            <ImportIntoProject projectId={projectId} onImported={onChanged} />
          </div>
        ) : (
          <EmptyRow>
            Worked on it elsewhere? Import the folder or a zip; files at the same path are replaced with your version.
          </EmptyRow>
        )}
      </Board>
      <div className="grid min-h-[60vh] grid-cols-1 border border-zinc-200 lg:grid-cols-[240px_minmax(0,1fr)] dark:border-zinc-800">
        <div className="flex flex-col border-b border-zinc-200 lg:border-b-0 lg:border-r dark:border-zinc-800">
          {groups.length === 0 && <EmptyRow>No files yet.</EmptyRow>}
          {groups.map(([folder, list]) => (
            <div key={folder} className="flex flex-col py-2">
              <span className="px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                {folder}
              </span>
              {list.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelected(f.path)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 text-left font-mono text-[12px] transition-colors',
                    f.path === selected
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
                  )}
                >
                  {f.path.endsWith('.sol') || f.path.endsWith('.jsx') || f.path.endsWith('.js') ? (
                    <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{f.path.slice(folder.length + 1)}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="mt-auto flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="contracts/New.sol"
              className={INPUT}
            />
            <Button
              variant="secondary"
              aria-label="Create file"
              disabled={!newPath}
              onClick={() => {
                void save(newPath, '');
                setNewPath('');
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          {selected ? (
            <Board className="flex min-h-0 flex-1 flex-col border-b-0">
              <BoardHeader
                label={selected}
                action={
                  draft === null ? (
                    <Button variant="ghost" onClick={() => setDraft(content ?? '')} disabled={content === null}>
                      Edit
                    </Button>
                  ) : (
                    <span className="flex gap-2">
                      <Button variant="ghost" onClick={() => setDraft(null)}>
                        Discard
                      </Button>
                      <Button onClick={() => void save(selected, draft)} busy={busy}>
                        Save
                      </Button>
                    </span>
                  )
                }
              />
              {error && (
                <div className="p-4">
                  <Notice tone="bad">{error}</Notice>
                </div>
              )}
              {draft !== null ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  className="min-h-[55vh] flex-1 resize-none bg-white p-4 font-mono text-[12px] leading-[1.6] text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100"
                />
              ) : content === null ? (
                <EmptyRow>Loading…</EmptyRow>
              ) : (
                <div
                  className="max-h-[70vh] overflow-auto"
                  onMouseUp={pickLines}
                  onKeyUp={pickLines}
                  onContextMenu={(e) => {
                    pickLines(e);
                    if (!window.getSelection()?.isCollapsed) e.preventDefault();
                  }}
                >
                  <table className="w-full border-collapse font-mono text-[12px] leading-[1.6]">
                    <tbody>
                      {content.split('\n').map((line, i) => (
                        <tr key={i} data-line={i + 1}>
                          <td className={cn(MUTED, 'w-12 select-none pr-3 text-right align-top text-[11px]')}>
                            {i + 1}
                          </td>
                          <td className="whitespace-pre pr-4 text-zinc-800 dark:text-zinc-200">{line || ' '}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Board>
          ) : (
            <EmptyRow>Select a file.</EmptyRow>
          )}
        </div>
      </div>
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
