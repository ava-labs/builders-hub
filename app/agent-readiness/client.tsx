'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = 'pending' | 'pass' | 'warn' | 'fail';

interface CheckResult {
  label: string;
  status: Status;
  detail: string;
}

const BADGE: Record<Status, string> = {
  pending: 'bg-zinc-200 text-zinc-700',
  pass: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  fail: 'bg-red-100 text-red-800',
};

function Row({ r }: { r: CheckResult }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800">
      <span className="font-medium">{r.label}</span>
      <span className="flex shrink-0 items-center gap-2 text-right">
        <span className="text-sm text-zinc-500">{r.detail}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${BADGE[r.status]}`}>
          {r.status}
        </span>
      </span>
    </div>
  );
}

const sizeBand = (n: number, ok: boolean): Status =>
  !ok ? 'fail' : n < 50000 ? 'pass' : n <= 100000 ? 'warn' : 'fail';

export default function AgentReadinessClient() {
  const [site, setSite] = useState<CheckResult[]>([]);
  const [path, setPath] = useState('/docs/avalanche-l1s');
  const [page, setPage] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const runSite = useCallback(async () => {
    const out: CheckResult[] = [];

    try {
      const res = await fetch('/llms.txt', { cache: 'no-store' });
      const n = (await res.text()).length;
      out.push({
        label: '/llms.txt',
        status: sizeBand(n, res.ok),
        detail: `${res.status} · ${n.toLocaleString()} chars (pass <50K · warn <100K)`,
      });
    } catch (e) {
      out.push({ label: '/llms.txt', status: 'fail', detail: String(e) });
    }

    try {
      const res = await fetch('/sitemap.xml', { cache: 'no-store' });
      const urls = ((await res.text()).match(/<loc>/g) || []).length;
      out.push({
        label: '/sitemap.xml',
        status: res.ok && urls > 0 ? 'pass' : 'fail',
        detail: `${res.status} · ${urls.toLocaleString()} urls`,
      });
    } catch (e) {
      out.push({ label: '/sitemap.xml', status: 'fail', detail: String(e) });
    }

    try {
      const res = await fetch('/robots.txt', { cache: 'no-store' });
      const hasSitemap = /sitemap/i.test(await res.text());
      out.push({
        label: '/robots.txt',
        status: res.ok && hasSitemap ? 'pass' : 'fail',
        detail: `${res.status} · ${hasSitemap ? 'links sitemap' : 'no sitemap ref'}`,
      });
    } catch (e) {
      out.push({ label: '/robots.txt', status: 'fail', detail: String(e) });
    }

    // The index-page .md fix: /…/index.md used to 404.
    try {
      const res = await fetch('/docs/tooling/avalanche-postman/index.md', { cache: 'no-store' });
      const ok = res.ok && (await res.text()).trimStart().startsWith('# ');
      out.push({
        label: 'index-page .md  (/…/index.md)',
        status: ok ? 'pass' : 'fail',
        detail: `${res.status} · ${ok ? 'serves markdown' : 'broken'}`,
      });
    } catch (e) {
      out.push({ label: 'index-page .md', status: 'fail', detail: String(e) });
    }

    setSite(out);
  }, []);

  useEffect(() => {
    void runSite();
  }, [runSite]);

  const runPage = useCallback(async () => {
    setRunning(true);
    const p = path.startsWith('/') ? path.replace(/\/$/, '') : `/${path}`;
    const out: CheckResult[] = [];

    try {
      const res = await fetch(`${p}.md`, { cache: 'no-store' });
      const text = await res.text();
      const h1 = text.trimStart().startsWith('# ');
      const directive = text.includes('/llms.txt');
      out.push({
        label: `${p}.md`,
        status: res.ok && h1 && directive ? 'pass' : 'fail',
        detail: `${res.status} · ${h1 ? 'H1 ✓' : 'no H1'} · ${directive ? 'llms.txt ✓' : 'no directive'}`,
      });
    } catch (e) {
      out.push({ label: `${p}.md`, status: 'fail', detail: String(e) });
    }

    try {
      const res = await fetch(p, { headers: { Accept: 'text/markdown' }, cache: 'no-store' });
      const body = (await res.text()).trimStart();
      const isMarkdown = body.startsWith('#');
      out.push({
        label: 'content negotiation (Accept: text/markdown)',
        status: res.ok && isMarkdown ? 'pass' : 'fail',
        detail: `${res.status} · ${isMarkdown ? 'served markdown' : 'served HTML'}`,
      });
    } catch (e) {
      out.push({ label: 'content negotiation', status: 'fail', detail: String(e) });
    }

    try {
      const res = await fetch(p, { cache: 'no-store' });
      const hasLink = (await res.text()).includes('href="/llms.txt"');
      out.push({
        label: 'in-body llms.txt link (HTML)',
        status: res.ok && hasLink ? 'pass' : 'fail',
        detail: res.ok ? (hasLink ? 'found <a href="/llms.txt">' : 'not found') : `${res.status}`,
      });
    } catch (e) {
      out.push({ label: 'in-body llms.txt link', status: 'fail', detail: String(e) });
    }

    setPage(out);
    setRunning(false);
  }, [path]);

  const examples = [
    '/docs/avalanche-l1s',
    '/academy/avalanche-l1/avalanche-fundamentals',
    '/blog/cortina-x-chain-linearization',
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-2xl font-bold">AI-Readiness Check</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Internal diagnostics for the Agent Score work — runs the same checks afdocs does, live against
        this deployment.
      </p>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Site-wide</h2>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {site.length === 0 ? (
            <p className="text-sm text-zinc-400">Running…</p>
          ) : (
            site.map((r, i) => <Row key={i} r={r} />)
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <a className="text-blue-600 underline" href="/llms.txt" target="_blank" rel="noreferrer">/llms.txt</a>
          <a className="text-blue-600 underline" href="/llms-full.txt" target="_blank" rel="noreferrer">/llms-full.txt</a>
          <a className="text-blue-600 underline" href="/sitemap.xml" target="_blank" rel="noreferrer">/sitemap.xml</a>
          <a className="text-blue-600 underline" href="/robots.txt" target="_blank" rel="noreferrer">/robots.txt</a>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Per page</h2>
        <div className="flex gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runPage()}
            placeholder="/docs/avalanche-l1s"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={() => void runPage()}
            disabled={running}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
        <div className="mt-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {page.length === 0 ? (
            <p className="text-sm text-zinc-400">Enter a page path and Run.</p>
          ) : (
            page.map((r, i) => <Row key={i} r={r} />)
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-500">
          {examples.map((s) => (
            <button key={s} onClick={() => setPath(s)} className="underline">
              {s}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
