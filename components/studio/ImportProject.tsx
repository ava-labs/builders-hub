'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderUp, FileArchive } from 'lucide-react';
import { Board, BoardHeader, MUTED } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import type { ImportResult } from '@/server/services/studio/imports';
import { api, errorText } from './api';
import { readFolder, readZip, type ReadResult } from './import-reader';
import { Button, Field, INPUT, LABEL, Notice } from './ui';

type Need = 'improve' | 'audit' | 'deploy';
const NEEDS: { id: Need; label: string }[] = [
  { id: 'improve', label: 'Improve the contracts' },
  { id: 'audit', label: 'Audit them' },
  { id: 'deploy', label: 'Plan and run deploy steps on testnet' },
];

/** The first message Studio's agent gets, so it starts from what the builder needs. */
function openingPrompt(result: ImportResult, about: string, needs: Need[]): string {
  const wants = NEEDS.filter((n) => needs.includes(n.id)).map((n) => n.label.toLowerCase());
  return [
    `I imported my existing ${result.framework === 'plain' ? '' : `${result.framework} `}project (${result.counts.contracts} contract files, ${result.counts.tests} tests).`,
    about ? `What I'm working on: ${about}` : '',
    wants.length ? `What I need: ${wants.join(', ')}.` : '',
    'Read docs/BRIEF.md and the contracts, compile and audit them, and tell me what you found before changing anything.',
  ]
    .filter(Boolean)
    .join(' ');
}

function Picker({ onRead, busy }: { onRead: (read: ReadResult) => void; busy: boolean }) {
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const read = async (fn: () => Promise<ReadResult>) => {
    setReading(true);
    setError(null);
    try {
      onRead(await fn());
    } catch (e) {
      setError(`Could not read that: ${errorText(e)}`);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" busy={reading} disabled={busy} onClick={() => folderRef.current?.click()}>
          <FolderUp className="h-3.5 w-3.5" /> Choose a folder
        </Button>
        <Button variant="secondary" busy={reading} disabled={busy} onClick={() => zipRef.current?.click()}>
          <FileArchive className="h-3.5 w-3.5" /> Choose a .zip
        </Button>
        <span className={cn(MUTED, 'text-[11px]')}>
          Foundry or Hardhat. lib/, node_modules/ and build output stay on your computer.
        </span>
      </div>
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => e.target.files?.length && void read(() => readFolder(e.target.files!))}
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void read(() => readZip(e.target.files![0]))}
      />
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}

/** What the import kept, replaced and could not take, in words the builder can act on. */
export function ImportSummary({ result }: { result: ImportResult }) {
  const replaced = result.imported.filter((f) => f.replaced).length;
  return (
    <div className="flex flex-col gap-2 text-[12.5px] text-zinc-700 dark:text-zinc-300">
      <span>
        Imported {result.imported.length} files ({result.counts.contracts} contracts, {result.counts.tests} tests,{' '}
        {result.counts.scripts} scripts, {result.counts.docs} docs)
        {replaced ? `, replacing ${replaced} with your newer version` : ''}. The brief is in {result.brief}.
      </span>
      {result.imports.unsupported.length > 0 && (
        <Notice tone="warn">
          Studio can&apos;t compile these imports yet: {result.imports.unsupported.join(', ')}. It builds with
          OpenZeppelin 5.3.0 and Chainlink CCIP 2.0.0 only; Studio will suggest the smallest change that compiles.
        </Notice>
      )}
      {result.openZeppelin && (
        <Notice tone="warn">
          Your project declares OpenZeppelin {result.openZeppelin.declared}; Studio builds against{' '}
          {result.openZeppelin.studio}, so some imports and constructors may need updating.
        </Notice>
      )}
      {result.pragmaConflicts.length > 0 && (
        <Notice tone="warn">
          These pin a compiler other than 0.8.28:{' '}
          {result.pragmaConflicts.map((c) => `${c.path} (${c.pragma})`).join(', ')}.
        </Notice>
      )}
      {result.skipped.length > 0 && (
        <details>
          <summary className={cn(LABEL, 'cursor-pointer select-none')}>
            {result.skipped.length} files not imported
          </summary>
          <ul className={cn(MUTED, 'mt-2 flex flex-col gap-0.5 text-[11px]')}>
            {result.skipped.slice(0, 50).map((s) => (
              <li key={s.path}>
                {s.path}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Starts a new Studio project from a project the builder already has. */
export function ImportNewProject({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [read, setRead] = useState<ReadResult | null>(null);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [needs, setNeeds] = useState<Need[]>(['audit']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!read) return;
    setBusy(true);
    setError(null);
    try {
      const { project, chatId } = await api<{ project: { id: string }; chatId: string }>('/api/studio/projects', {
        method: 'POST',
        json: {
          name: name.trim() || read.root || 'Imported project',
          ...(about.trim() ? { description: about.trim().slice(0, 500) } : {}),
        },
      });
      const result = await api<ImportResult>(`/api/studio/projects/${project.id}/import`, {
        method: 'POST',
        json: { files: read.files, about: about.trim(), needs },
      });
      const query = new URLSearchParams({
        ...(chatId ? { chat: chatId } : {}),
        prompt: openingPrompt(result, about.trim(), needs),
      });
      router.push(`/console/studio/${project.id}?${query.toString()}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Board>
      <BoardHeader
        label="Import a project you already started"
        action={
          <Button variant="ghost" className="h-6 px-1" onClick={onCancel} disabled={busy}>
            Close
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-5 py-4 md:px-6">
        <Picker
          busy={busy}
          onRead={(r) => {
            setRead(r);
            if (!name) setName(r.root);
          }}
        />
        {read && (
          <span className={cn(MUTED, 'text-[11px]')}>
            Read {read.files.length} files from {read.root || 'your selection'}
            {read.leftOut
              ? `; left ${read.leftOut} on your computer (dependencies, build output and other file types)`
              : ''}
            .
          </span>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My protocol" className={INPUT} />
          </Field>
          <Field label="What do you need?">
            <span className="flex flex-col gap-1.5 pt-1">
              {NEEDS.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-[12.5px] text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={needs.includes(n.id)}
                    onChange={(e) =>
                      setNeeds((cur) => (e.target.checked ? [...cur, n.id] : cur.filter((x) => x !== n.id)))
                    }
                  />
                  {n.label}
                </label>
              ))}
            </span>
          </Field>
        </div>
        <Field
          label="What are you working on?"
          hint="What it does, what you changed recently, and what worries you. Studio reads this before anything else."
        >
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="A staking vault for our game token. I just added withdrawal fees and want an audit before deploying it to Fuji."
            className={cn(INPUT, 'h-auto py-2 font-sans text-[13px]')}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()} busy={busy} disabled={!read || read.files.length === 0}>
            Import and open
          </Button>
          <span className={cn(MUTED, 'text-[11px]')}>
            Studio compiles and audits it first and asks before changing your code.
          </span>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </Board>
  );
}

/** Brings newer files into a project that already exists, e.g. after working on it elsewhere. */
export function ImportIntoProject({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [read, setRead] = useState<ReadResult | null>(null);
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!read) return;
    setBusy(true);
    setError(null);
    try {
      const imported = await api<ImportResult>(`/api/studio/projects/${projectId}/import`, {
        method: 'POST',
        json: { files: read.files, about: about.trim(), needs: [] },
      });
      setResult(imported);
      setRead(null);
      onImported();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Picker busy={busy} onRead={setRead} />
      {read && (
        <>
          <span className={cn(MUTED, 'text-[11px]')}>
            Read {read.files.length} files. Files at the same path are replaced with these; others stay as they are.
          </span>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="What changed, and what you want next (optional, saved to docs/BRIEF.md)"
            className={cn(INPUT, 'h-auto py-2 font-sans text-[13px]')}
          />
          <div>
            <Button onClick={() => void submit()} busy={busy}>
              Import {read.files.length} files
            </Button>
          </div>
        </>
      )}
      {result && <ImportSummary result={result} />}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
