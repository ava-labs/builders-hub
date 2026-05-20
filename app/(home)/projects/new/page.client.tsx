'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { X as XIcon } from 'lucide-react';
import {
  GITHUB_ACCOUNT_PATTERN,
  LINKEDIN_ACCOUNT_PATTERN,
  X_ACCOUNT_PATTERN,
} from '@/lib/profile/socialAccountValidation';
import { LogoUploader } from '@/components/ecosystem-careers/LogoUploader';
import {
  UserSearchPicker,
  type SearchUser,
} from '@/components/common/UserSearchPicker';

interface Props {
  userId: string;
  currentUserName: string | null;
  currentUserImage: string | null;
}

const HTTPS_RE = /^https?:\/\//i;

export function NewProjectForm({ userId, currentUserName, currentUserImage }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    project_name: '',
    full_description: '',
    logo_url: '',
    website: '',
    x_account: '',
    linkedin_account: '',
    github_account: '',
    tags: '',
  });
  const [teamMembers, setTeamMembers] = useState<SearchUser[]>([]);
  const update = <K extends keyof typeof values>(k: K, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (values.project_name.trim().length < 2)
      return toast.error('Project name is too short.');
    if (values.full_description.trim().length < 30)
      return toast.error('About should be at least 30 characters.');
    if (!values.logo_url.trim())
      return toast.error('Logo is required — upload a square image.');

    const website = values.website.trim();
    if (!website || !HTTPS_RE.test(website))
      return toast.error('Website is required (https://…).');

    const x = values.x_account.trim();
    if (!x) return toast.error('Company X account is required.');
    if (!X_ACCOUNT_PATTERN.test(x))
      return toast.error('Company X account should look like https://x.com/yourcompany');

    const linkedin = values.linkedin_account.trim();
    if (!linkedin) return toast.error('Company LinkedIn account is required.');
    if (!LINKEDIN_ACCOUNT_PATTERN.test(linkedin))
      return toast.error(
        'Company LinkedIn should look like https://linkedin.com/company/yourcompany',
      );

    const github = values.github_account.trim();
    if (github && !GITHUB_ACCOUNT_PATTERN.test(github))
      return toast.error(
        'GitHub should look like https://github.com/yourorg or just `yourorg`.',
      );

    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const socials: Record<string, string> = { x, linkedin };
    if (github) socials.github = github;

    const additionalMembers = teamMembers
      .filter((m) => m.id !== userId)
      .map((m) => ({
        user_id: m.id,
        role: 'Member',
        // New members start in pending state — they accept the invitation
        // via the existing inbox/notifications flow.
        status: 'Pending Confirmation',
      }));

    // Derive a card-friendly teaser from the full description.
    const fullDesc = values.full_description.trim();
    const teaser = fullDesc
      .replace(/\s+/g, ' ')
      .slice(0, 260)
      .replace(/\s\S*$/, '') // don't cut a word in half
      .trim();
    const shortDescription = teaser.length < fullDesc.length ? `${teaser}…` : teaser;

    const body = {
      project_name: values.project_name.trim(),
      short_description: shortDescription,
      full_description: fullDesc,
      logo_url: values.logo_url.trim() || '',
      website: { primary: website },
      socials,
      tags,
      tracks: [],
      origin: 'builders-hub',
      hackaton_id: null,
      members: [
        { user_id: userId, role: 'Member', status: 'Confirmed' },
        ...additionalMembers,
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

  function addTeamMember(user: SearchUser) {
    if (user.id === userId) return;
    setTeamMembers((prev) => (prev.some((m) => m.id === user.id) ? prev : [...prev, user]));
  }

  function removeTeamMember(id: string) {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
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

      <LogoUploader
        value={values.logo_url}
        onChange={(url) => update('logo_url', url)}
        required
      />

      <Field
        label="About"
        required
        hint="A short paragraph about your team. The first ~260 chars show on cards."
      >
        <textarea
          value={values.full_description}
          onChange={(e) => update('full_description', e.target.value)}
          rows={5}
          className={textareaCls}
          placeholder="What does your team build, and what's the elevator pitch?"
        />
      </Field>

      <Field label="Website" required hint="Your team's canonical site.">
        <input
          type="url"
          value={values.website}
          onChange={(e) => update('website', e.target.value)}
          className={inputCls}
          placeholder="https://yourcompany.com"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Company X account" required hint="https://x.com/…">
          <input
            type="url"
            value={values.x_account}
            onChange={(e) => update('x_account', e.target.value)}
            className={inputCls}
            placeholder="https://x.com/yourcompany"
          />
        </Field>
        <Field
          label="Company LinkedIn account"
          required
          hint="Company or organization page."
        >
          <input
            type="url"
            value={values.linkedin_account}
            onChange={(e) => update('linkedin_account', e.target.value)}
            className={inputCls}
            placeholder="https://linkedin.com/company/yourcompany"
          />
        </Field>
      </div>

      <Field
        label="GitHub"
        hint="Optional — organization URL or handle."
      >
        <input
          type="text"
          value={values.github_account}
          onChange={(e) => update('github_account', e.target.value)}
          className={inputCls}
          placeholder="https://github.com/yourorg"
        />
      </Field>

      <Field
        label="Team members"
        hint="Optional — invite other Builders Hub users by name. They'll see a pending invite to accept."
      >
        <UserSearchPicker
          onSelect={addTeamMember}
          excludeUserIds={[userId, ...teamMembers.map((m) => m.id)]}
          placeholder="Search by name…"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <MemberChip
            name={currentUserName ?? 'You'}
            image={currentUserImage}
            role="Creator"
            removable={false}
          />
          {teamMembers.map((m) => (
            <MemberChip
              key={m.id}
              name={m.name ?? m.user_name ?? 'Member'}
              image={m.image}
              role="Pending"
              removable
              onRemove={() => removeTeamMember(m.id)}
            />
          ))}
        </div>
      </Field>

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

function MemberChip({
  name,
  image,
  role,
  removable,
  onRemove,
}: {
  name: string;
  image: string | null | undefined;
  role: string;
  removable: boolean;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 text-sm">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="text-zinc-900 dark:text-zinc-100">{name}</span>
      <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {role}
      </span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label={`Remove ${name}`}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
}

const inputCls =
  'w-full px-4 py-2.5 text-sm rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60 transition';
const textareaCls = `${inputCls} resize-y leading-relaxed`;
