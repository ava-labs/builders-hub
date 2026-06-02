'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { X as XIcon, Puzzle } from 'lucide-react';
import {
  GITHUB_ACCOUNT_PATTERN,
  LINKEDIN_ACCOUNT_PATTERN,
  X_ACCOUNT_PATTERN,
} from '@/lib/profile/socialAccountValidation';
import { LogoUploader } from '@/components/common/LogoUploader';
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

  // Mono-prefix social inputs: store the full URL but show only the handle/slug.
  function stripPrefix(value: string, prefix: RegExp): string {
    return value.replace(prefix, '').replace(/\/+$/, '');
  }
  const xHandle = stripPrefix(values.x_account, /^https?:\/\/(?:www\.)?x\.com\//i);
  const linkedinSlug = stripPrefix(
    values.linkedin_account,
    /^https?:\/\/(?:www\.)?linkedin\.com\/company\//i,
  );
  const githubHandle = stripPrefix(
    values.github_account,
    /^https?:\/\/(?:www\.)?github\.com\//i,
  );

  const setUrlField = (key: 'x_account' | 'linkedin_account' | 'github_account', base: string, slug: string) => {
    const cleaned = slug.trim().replace(/^\/+|\/+$/g, '');
    update(key, cleaned ? `${base}${cleaned}` : '');
  };

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
        status: 'Pending Confirmation',
      }));

    const fullDesc = values.full_description.trim();
    const teaser = fullDesc
      .replace(/\s+/g, ' ')
      .slice(0, 260)
      .replace(/\s\S*$/, '')
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

  const dirty =
    !!values.project_name.trim() ||
    !!values.full_description.trim() ||
    !!values.logo_url.trim() ||
    !!values.website.trim() ||
    !!values.x_account.trim() ||
    !!values.linkedin_account.trim() ||
    !!values.github_account.trim() ||
    !!values.tags.trim() ||
    teamMembers.length > 0;

  return (
    <form onSubmit={onSubmit}>
      <div className="pr-card">
        <div className="pr-head">
          <div className="pr-ico">
            <Puzzle size={18} />
          </div>
          <div>
            <h3>Project profile</h3>
            <div className="pr-desc">
              Team-level info that powers your listings on Ecosystem Careers.
            </div>
          </div>
        </div>

        <div className="pr-body">
          <div className="pr-field">
            <label htmlFor="np-name">
              Project name <span className="pr-req">*</span>
            </label>
            <input
              id="np-name"
              type="text"
              className="pr-input"
              value={values.project_name}
              onChange={(e) => update('project_name', e.target.value)}
              maxLength={120}
              placeholder="Acme Labs"
            />
          </div>

          <LogoUploader
            value={values.logo_url}
            onChange={(url) => update('logo_url', url)}
            required
          />

          <div className="pr-field">
            <label htmlFor="np-about">
              About <span className="pr-req">*</span>
            </label>
            <textarea
              id="np-about"
              className="pr-input"
              style={{ minHeight: 140 }}
              value={values.full_description}
              onChange={(e) => update('full_description', e.target.value)}
              rows={5}
              placeholder="What does your team build, and what's the elevator pitch?"
            />
            <div className="pr-helper">
              <span>The first ~260 chars show on cards.</span>
              <span style={{ fontFamily: 'var(--pr-mono)' }}>
                {values.full_description.length} chars
              </span>
            </div>
          </div>

          <div className="pr-field">
            <label htmlFor="np-website">
              Website <span className="pr-req">*</span>
            </label>
            <input
              id="np-website"
              type="url"
              className="pr-input"
              value={values.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://yourcompany.com"
            />
          </div>

          <div className="pr-field-row">
            <div className="pr-field">
              <label htmlFor="np-x">
                Company X account <span className="pr-req">*</span>
              </label>
              <div className="pr-input-group">
                <span className="pr-pre">x.com/</span>
                <input
                  id="np-x"
                  type="text"
                  value={xHandle}
                  onChange={(e) => setUrlField('x_account', 'https://x.com/', e.target.value)}
                  placeholder="yourcompany"
                />
              </div>
            </div>
            <div className="pr-field">
              <label htmlFor="np-li">
                Company LinkedIn <span className="pr-req">*</span>
              </label>
              <div className="pr-input-group">
                <span className="pr-pre">linkedin.com/company/</span>
                <input
                  id="np-li"
                  type="text"
                  value={linkedinSlug}
                  onChange={(e) =>
                    setUrlField('linkedin_account', 'https://linkedin.com/company/', e.target.value)
                  }
                  placeholder="yourcompany"
                />
              </div>
            </div>
          </div>

          <div className="pr-field">
            <label htmlFor="np-gh">
              GitHub <span className="pr-opt">— optional org or handle</span>
            </label>
            <div className="pr-input-group">
              <span className="pr-pre">github.com/</span>
              <input
                id="np-gh"
                type="text"
                value={githubHandle}
                onChange={(e) => setUrlField('github_account', 'https://github.com/', e.target.value)}
                placeholder="yourorg"
              />
            </div>
          </div>

          <div className="pr-field">
            <label>
              Team members <span className="pr-opt">— optional, send pending invites</span>
            </label>
            <UserSearchPicker
              onSelect={addTeamMember}
              excludeUserIds={[userId, ...teamMembers.map((m) => m.id)]}
              placeholder="Search by name…"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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
          </div>

          <div className="pr-field">
            <label htmlFor="np-tags">
              Tags <span className="pr-opt">— comma-separated, max 10</span>
            </label>
            <input
              id="np-tags"
              type="text"
              className="pr-input"
              value={values.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder="defi, infra, gaming"
            />
          </div>
        </div>
      </div>

      <div
        className={`pr-savebar${dirty || submitting ? '' : ' pr-hidden'}`}
        role="status"
        aria-live="polite"
      >
        <span className="pr-dot" />
        <span className="pr-msg">
          <b>Ready to create</b> — you&apos;ll be sent to post your first role.
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
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
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
    <span
      className="pr-chip"
      style={{ paddingLeft: 4, paddingRight: removable ? 4 : 10, gap: 8 }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--pr-g-300)',
          color: 'var(--pr-g-800)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 10,
          fontWeight: 600,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span>{name}</span>
      <span style={{ fontSize: 10, opacity: 0.6, fontFamily: 'var(--pr-mono)' }}>{role}</span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="pr-btn pr-btn--icon pr-btn--ghost"
          style={{ width: 22, height: 22, padding: 0 }}
          aria-label={`Remove ${name}`}
        >
          <XIcon size={12} />
        </button>
      )}
    </span>
  );
}
