'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProjectOption {
  id: string;
  project_name: string;
  logo_url: string | null;
}

export interface SubmitListingFormInitialValues {
  project_id: string;
  title: string;
  short_description: string;
  description: string;
  location: string;
  remote_type: 'remote' | 'onsite' | 'hybrid' | '';
  employment_type: 'full_time' | 'contract' | 'part_time' | '';
  seniority: string;
  tags: string;
  apply_url: string;
}

interface Props {
  projects: ProjectOption[];
  initialValues?: Partial<SubmitListingFormInitialValues>;
  listingId?: string; // when set, PUT instead of POST
}

const EMPTY: SubmitListingFormInitialValues = {
  project_id: '',
  title: '',
  short_description: '',
  description: '',
  location: '',
  remote_type: '',
  employment_type: '',
  seniority: '',
  tags: '',
  apply_url: '',
};

const REMOTE_OPTS = [
  { value: '', label: 'Not specified' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const EMPLOYMENT_OPTS = [
  { value: '', label: 'Not specified' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'part_time', label: 'Part-time' },
];

const SENIORITY_OPTS = [
  { value: '', label: 'Not specified' },
  { value: 'intern', label: 'Intern' },
  { value: 'entry', label: 'Entry' },
  { value: 'associate', label: 'Associate' },
  { value: 'mid_senior', label: 'Mid–senior' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'lead', label: 'Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'cxo', label: 'Executive' },
];

export function SubmitListingForm({ projects, initialValues, listingId }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<SubmitListingFormInitialValues>({
    ...EMPTY,
    project_id: projects[0]?.id ?? '',
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof SubmitListingFormInitialValues>(
    key: K,
    value: SubmitListingFormInitialValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!values.project_id) return toast.error('Pick a project.');
    if (values.title.trim().length < 2) return toast.error('Job title is too short.');
    if (values.description.trim().length < 20)
      return toast.error('Job description should be at least 20 characters.');
    try {
      new URL(values.apply_url.trim());
    } catch {
      return toast.error('Apply URL must be a valid https://… link.');
    }

    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    const body = {
      project_id: values.project_id,
      title: values.title.trim(),
      short_description: values.short_description.trim() || null,
      description: values.description.trim(),
      location: values.location.trim() || null,
      remote_type: values.remote_type || null,
      employment_type: values.employment_type || null,
      seniority: values.seniority || null,
      tags,
      apply_url: values.apply_url.trim(),
    };

    setSubmitting(true);
    try {
      const url = listingId
        ? `/api/ecosystem-careers/listings/${listingId}`
        : '/api/ecosystem-careers/listings';
      const res = await fetch(url, {
        method: listingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (payload as { message?: string; error?: string }).message ||
          (payload as { error?: string }).error ||
          'Something went wrong.';
        toast.error(msg);
        return;
      }
      toast.success(listingId ? 'Listing updated.' : 'Listing published.');
      const targetId = (payload as { id?: string }).id ?? listingId;
      router.push(targetId ? `/ecosystem-careers/${targetId}` : '/ecosystem-careers/my-listings');
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
      <Field label="Project" required>
        <select
          value={values.project_id}
          onChange={(e) => update('project_id', e.target.value)}
          className={selectCls}
          disabled={!!listingId}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </select>
        {!listingId && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Don&apos;t see your team? <a className="text-red-600 dark:text-red-400 hover:underline" href="/projects/new">Create a project →</a>
          </p>
        )}
      </Field>

      <Field label="Job title" required>
        <input
          type="text"
          value={values.title}
          onChange={(e) => update('title', e.target.value)}
          maxLength={160}
          className={inputCls}
          placeholder="e.g. Senior Solidity Engineer"
        />
      </Field>

      <Field
        label="Short description"
        hint="Optional — defaults to the first ~280 chars of the full description."
      >
        <textarea
          value={values.short_description}
          onChange={(e) => update('short_description', e.target.value)}
          maxLength={280}
          rows={2}
          className={textareaCls}
          placeholder="One-liner shown on the job card."
        />
      </Field>

      <Field label="Full description" required hint="Markdown is OK. Sanitized server-side.">
        <textarea
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          rows={10}
          className={textareaCls}
          placeholder="What does the role involve? What does the team look like? Tech stack, perks, anything candidates need."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Location" hint='Free text — e.g. "Remote", "London, UK".'>
          <input
            type="text"
            value={values.location}
            onChange={(e) => update('location', e.target.value)}
            maxLength={120}
            className={inputCls}
          />
        </Field>
        <Field label="Work mode">
          <select
            value={values.remote_type}
            onChange={(e) => update('remote_type', e.target.value as SubmitListingFormInitialValues['remote_type'])}
            className={selectCls}
          >
            {REMOTE_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment type">
          <select
            value={values.employment_type}
            onChange={(e) => update('employment_type', e.target.value as SubmitListingFormInitialValues['employment_type'])}
            className={selectCls}
          >
            {EMPLOYMENT_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Seniority">
          <select
            value={values.seniority}
            onChange={(e) => update('seniority', e.target.value)}
            className={selectCls}
          >
            {SENIORITY_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Tags" hint="Comma-separated, max 6 — e.g. solidity, defi, remote-ok.">
        <input
          type="text"
          value={values.tags}
          onChange={(e) => update('tags', e.target.value)}
          className={inputCls}
          placeholder="solidity, defi"
        />
      </Field>

      <Field label="Apply URL" required hint="LinkedIn, your careers page, Greenhouse — wherever applicants should land.">
        <input
          type="url"
          value={values.apply_url}
          onChange={(e) => update('apply_url', e.target.value)}
          className={inputCls}
          placeholder="https://yourcompany.com/careers/role-123"
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
          {submitting ? 'Saving…' : listingId ? 'Save changes' : 'Publish listing'}
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

const selectCls = inputCls;
