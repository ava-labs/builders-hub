'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  userId: string;
}

export function NewProjectForm({ userId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    project_name: '',
    short_description: '',
    full_description: '',
    logo_url: '',
    website: '',
    tags: '',
  });
  const update = <K extends keyof typeof values>(k: K, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (values.project_name.trim().length < 2) return toast.error('Project name is too short.');
    if (values.short_description.trim().length < 10)
      return toast.error('Short description should be at least 10 characters.');

    if (values.website && !/^https?:\/\//i.test(values.website.trim())) {
      return toast.error('Website should start with https://');
    }
    if (values.logo_url && !/^https?:\/\//i.test(values.logo_url.trim())) {
      return toast.error('Logo URL should start with https://');
    }

    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const body = {
      project_name: values.project_name.trim(),
      short_description: values.short_description.trim(),
      full_description: values.full_description.trim() || '',
      logo_url: values.logo_url.trim() || '',
      website: values.website.trim() ? { primary: values.website.trim() } : null,
      tags,
      tracks: [],
      origin: 'builders-hub',
      hackaton_id: null,
      members: [
        { user_id: userId, role: 'Member', status: 'Confirmed' },
      ],
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (payload as { message?: string; error?: string }).message ||
          (payload as { error?: string }).error ||
          'Something went wrong.';
        toast.error(typeof msg === 'string' ? msg : 'Could not create project.');
        return;
      }
      const projectId = (payload as { project?: { id?: string } }).project?.id;
      toast.success('Project created.');
      router.push(
        projectId
          ? `/ecosystem-careers/submit?project=${encodeURIComponent(projectId)}`
          : '/ecosystem-careers/submit',
      );
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Project name" required>
        <input
          type="text"
          value={values.project_name}
          onChange={(e) => update('project_name', e.target.value)}
          maxLength={120}
          className={inputCls}
          placeholder="Acme Labs"
        />
      </Field>
      <Field label="Short description" required hint="One-liner shown on cards.">
        <input
          type="text"
          value={values.short_description}
          onChange={(e) => update('short_description', e.target.value)}
          maxLength={200}
          className={inputCls}
          placeholder="What does your team build?"
        />
      </Field>
      <Field label="About" hint="Optional longer description.">
        <textarea
          value={values.full_description}
          onChange={(e) => update('full_description', e.target.value)}
          rows={5}
          className={textareaCls}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Logo URL" hint="Optional — https://… image.">
          <input
            type="url"
            value={values.logo_url}
            onChange={(e) => update('logo_url', e.target.value)}
            className={inputCls}
            placeholder="https://yourcompany.com/logo.png"
          />
        </Field>
        <Field label="Website" hint="Optional.">
          <input
            type="url"
            value={values.website}
            onChange={(e) => update('website', e.target.value)}
            className={inputCls}
            placeholder="https://yourcompany.com"
          />
        </Field>
      </div>
      <Field label="Tags" hint="Comma-separated, max 10 — e.g. defi, infra, gaming.">
        <input
          type="text"
          value={values.tags}
          onChange={(e) => update('tags', e.target.value)}
          className={inputCls}
        />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100"
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition';
const textareaCls = `${inputCls} resize-y leading-relaxed`;
