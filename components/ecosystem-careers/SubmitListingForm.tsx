'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Briefcase } from 'lucide-react';
import { POPULAR_LOCATIONS } from '@/lib/ecosystem-careers/locations';

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
  { value: 'full_time', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'part_time', label: 'Part-time' },
];

const DIRTY_INITIAL = (initial: SubmitListingFormInitialValues): SubmitListingFormInitialValues =>
  ({ ...initial });

export function SubmitListingForm({ projects, initialValues, listingId }: Props) {
  const router = useRouter();
  const locationsListId = useId();
  const initial: SubmitListingFormInitialValues = {
    ...EMPTY,
    project_id: projects[0]?.id ?? '',
    ...initialValues,
  };
  const [values, setValues] = useState<SubmitListingFormInitialValues>(DIRTY_INITIAL(initial));
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof SubmitListingFormInitialValues>(
    key: K,
    value: SubmitListingFormInitialValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  // When the user picks a "Remote (…)" location from the datalist (or types
  // one with that prefix), nudge the work-mode dropdown to "Remote" so they
  // don't have to set it twice. Doesn't overwrite an existing onsite/hybrid
  // choice if they explicitly set one.
  function setLocation(next: string) {
    setValues((prev) => {
      const looksRemote = /^remote\b/i.test(next.trim());
      return {
        ...prev,
        location: next,
        remote_type:
          looksRemote && prev.remote_type === '' ? 'remote' : prev.remote_type,
      };
    });
  }

  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!values.project_id) return toast.error('Pick a project.');
    if (values.title.trim().length < 2) return toast.error('Job title is too short.');
    if (values.description.trim().length < 20)
      return toast.error('Job description should be at least 20 characters.');
    if (!values.location.trim()) return toast.error('Location is required.');
    if (!values.employment_type)
      return toast.error('Employment type is required.');
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

    const yearsRaw = values.seniority.trim();
    let seniorityLabel: string | null = null;
    if (yearsRaw) {
      const n = Number.parseInt(yearsRaw, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 40) {
        seniorityLabel = n === 0 ? 'Entry / no experience' : `${n}+ years`;
      } else {
        return toast.error('Years of experience must be a number between 0 and 40.');
      }
    }

    const body = {
      project_id: values.project_id,
      title: values.title.trim(),
      short_description: null,
      description: values.description.trim(),
      location: values.location.trim(),
      remote_type: values.remote_type || null,
      employment_type: values.employment_type,
      seniority: seniorityLabel,
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
      toast.success(
        listingId
          ? 'Listing updated.'
          : 'Listing submitted — waiting on devrel review.',
      );
      router.push('/ecosystem-careers/my-listings');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="pr-card">
        <div className="pr-head">
          <div className="pr-ico">
            <Briefcase size={18} />
          </div>
          <div>
            <h3>{listingId ? 'Edit role' : 'Post a role'}</h3>
            <div className="pr-desc">
              Roles link out to your apply URL. Builders Hub never hosts applications.
            </div>
          </div>
        </div>

        <div className="pr-body">
          <div className="pr-field">
            <label htmlFor="ec-project">
              Project <span className="pr-req">*</span>
            </label>
            <select
              id="ec-project"
              className="pr-input"
              value={values.project_id}
              onChange={(e) => update('project_id', e.target.value)}
              disabled={!!listingId}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
            {!listingId && (
              <div className="pr-helper">
                <span>
                  Don&apos;t see your team?{' '}
                  <a className="text-red-600 dark:text-red-400 hover:underline" href="/projects/new">
                    Create a project →
                  </a>
                </span>
              </div>
            )}
          </div>

          <div className="pr-field">
            <label htmlFor="ec-title">
              Job title <span className="pr-req">*</span>
            </label>
            <input
              id="ec-title"
              type="text"
              className="pr-input"
              value={values.title}
              onChange={(e) => update('title', e.target.value)}
              maxLength={160}
              placeholder="e.g. Senior Solidity Engineer"
            />
            <div className="pr-helper">
              <span />
              <span style={{ fontFamily: 'var(--pr-mono)' }}>
                {values.title.length}/160
              </span>
            </div>
          </div>

          <div className="pr-field">
            <label htmlFor="ec-description">
              Job description <span className="pr-req">*</span>
            </label>
            <textarea
              id="ec-description"
              className="pr-input"
              style={{ minHeight: 220 }}
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              rows={10}
              placeholder="What does the role involve? Tech stack, team shape, perks, anything candidates need."
            />
            <div className="pr-helper">
              <span>Markdown supported — sanitized server-side. First ~280 chars auto-fill the card teaser.</span>
              <span style={{ fontFamily: 'var(--pr-mono)' }}>
                {values.description.length} chars
              </span>
            </div>
          </div>

          <div className="pr-field-row">
            <div className="pr-field">
              <label htmlFor="ec-location">
                Location <span className="pr-req">*</span>
              </label>
              <input
                id="ec-location"
                type="text"
                list={locationsListId}
                className="pr-input"
                value={values.location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                placeholder="Search a city, country, or remote region…"
                autoComplete="off"
              />
              <datalist id={locationsListId}>
                {POPULAR_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
              <div className="pr-helper">
                <span>Picking &ldquo;Remote (…)&rdquo; auto-sets work mode.</span>
              </div>
            </div>
            <div className="pr-field">
              <label htmlFor="ec-remote">Work mode</label>
              <select
                id="ec-remote"
                className="pr-input"
                value={values.remote_type}
                onChange={(e) =>
                  update('remote_type', e.target.value as SubmitListingFormInitialValues['remote_type'])
                }
              >
                {REMOTE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pr-field-row">
            <div className="pr-field">
              <label htmlFor="ec-employment">
                Employment type <span className="pr-req">*</span>
              </label>
              <select
                id="ec-employment"
                className="pr-input"
                value={values.employment_type}
                onChange={(e) =>
                  update(
                    'employment_type',
                    e.target.value as SubmitListingFormInitialValues['employment_type'],
                  )
                }
              >
                <option value="" disabled>
                  Select one…
                </option>
                {EMPLOYMENT_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pr-field">
              <label htmlFor="ec-seniority">Years of work experience</label>
              <input
                id="ec-seniority"
                type="number"
                inputMode="numeric"
                min={0}
                max={40}
                className="pr-input"
                value={values.seniority}
                onChange={(e) => update('seniority', e.target.value)}
                placeholder="e.g. 3"
              />
              <div className="pr-helper">
                <span>Minimum candidates should bring. Leave blank for any.</span>
              </div>
            </div>
          </div>

          <div className="pr-field">
            <label htmlFor="ec-tags">
              Tags <span className="pr-opt">— comma-separated, max 6</span>
            </label>
            <input
              id="ec-tags"
              type="text"
              className="pr-input"
              value={values.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder="solidity, defi, remote-ok"
            />
          </div>

          <div className="pr-field">
            <label htmlFor="ec-apply">
              Apply URL <span className="pr-req">*</span>
            </label>
            <input
              id="ec-apply"
              type="url"
              className="pr-input"
              value={values.apply_url}
              onChange={(e) => update('apply_url', e.target.value)}
              placeholder="https://yourcompany.com/careers/role-123"
            />
            <div className="pr-helper">
              <span>LinkedIn, your careers page, Greenhouse — wherever applicants should land.</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`pr-savebar${isDirty || submitting ? '' : ' pr-hidden'}`}
        role="status"
        aria-live="polite"
      >
        <span className="pr-dot" />
        <span className="pr-msg">
          {listingId ? (
            <>
              <b>Unsaved changes</b> — review and save when you&apos;re ready.
            </>
          ) : (
            <>
              <b>Ready to submit</b> — devrel reviews new teams within a week.
            </>
          )}
        </span>
        <button
          type="button"
          className="pr-btn pr-btn--ghost pr-btn--sm"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="pr-btn pr-btn--primary pr-btn--sm"
          disabled={submitting}
        >
          {submitting ? 'Saving…' : listingId ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
    </form>
  );
}
