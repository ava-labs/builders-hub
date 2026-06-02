'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  listingId: string;
  currentTitle: string;
  currentLogoUrl: string | null;
}

export function DevRelEditButton({
  listingId,
  currentTitle,
  currentLogoUrl,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
      setLogoUrl(currentLogoUrl ?? '');
    }
  }, [open, currentTitle, currentLogoUrl]);

  const dirty =
    title.trim() !== currentTitle.trim() ||
    (logoUrl.trim() || null) !== (currentLogoUrl?.trim() || null);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const body: { title?: string; company_logo?: string | null } = {};
      if (title.trim() !== currentTitle.trim()) body.title = title.trim();
      if ((logoUrl.trim() || null) !== (currentLogoUrl?.trim() || null)) {
        body.company_logo = logoUrl.trim() || null;
      }
      const res = await fetch(
        `/api/admin/ecosystem-careers/listings/${listingId}/patch`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error ?? 'Could not save.');
        return;
      }
      toast.success('Listing updated.');
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error.');
    } finally {
      setSaving(false);
    }
  }

  function stop(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setOpen(true);
        }}
        title="Devrel: quick edit"
        aria-label="Quick edit listing"
        className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white shadow-sm"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={(e) => {
            stop(e);
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-5"
            onClick={stop}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  Quick edit
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Devrel-only · fixes persist across the weekly ingest.
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setOpen(false);
                }}
                aria-label="Close"
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Title
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Company logo URL
              </span>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60"
              />
              {logoUrl.trim() && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Preview:
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="logo preview"
                    className="w-10 h-10 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.3';
                    }}
                  />
                </div>
              )}
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setOpen(false);
                }}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  save();
                }}
                disabled={!dirty || saving}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
