"use client";

import * as React from "react";
import Image from "next/image";
import { Plus, Send, Check } from "lucide-react";
import {
  GitHubIcon,
  TelegramIcon,
  LinkedInIcon,
  XIcon,
  WebsiteIcon,
  MailIcon,
  GlobeIcon,
} from "./icons";
import {
  extractGithubUsername,
  extractXUsername,
  extractLinkedInSlug,
} from "./adapter";
import type { ProfileLink } from "./types";
import type { CompletionResult } from "@/lib/profile/completion";

interface Props {
  fullName: string;
  handle?: string | null;
  email?: string | null;
  bio?: string | null;
  country?: string | null;
  github?: string | null;
  telegram?: string | null;
  xAccount?: string | null;
  linkedinAccount?: string | null;
  imageUrl?: string | null;
  walletCount: number;
  teamLabel?: string | null;
  links: ProfileLink[];
  completion: CompletionResult;
  inviteShareUrl?: string | null;
  onInviteCopy?: () => void;
  onEditAvatar?: () => void;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

function SitePill({ link }: { link: ProfileLink }) {
  if (!link.url) return null;
  let display = link.url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (display.length > 28) display = display.slice(0, 28) + "...";
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pr-pill-link"
      title={link.url}
    >
      <WebsiteIcon size={13} />
      {display}
    </a>
  );
}

function InviteButton({
  shareUrl,
  onCopy,
}: {
  shareUrl: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const handleClick = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
    }
    setCopied(true);
    onCopy?.();
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="pr-chip pr-chip--avax"
      style={{ cursor: "pointer", border: 0 }}
      title={shareUrl}
      aria-label="Copy your Builder Hub invite link"
    >
      {copied ? (
        <>
          <Check size={11} /> Copied
        </>
      ) : (
        <>
          <Send size={11} /> Invite a friend
        </>
      )}
    </button>
  );
}

export function IdentityHero({
  fullName,
  handle,
  email,
  bio,
  country,
  github,
  telegram,
  xAccount,
  linkedinAccount,
  imageUrl,
  walletCount,
  teamLabel,
  links,
  completion,
  inviteShareUrl,
  onInviteCopy,
  onEditAvatar,
}: Props) {
  const inits = initials(fullName);
  const next = completion.next;
  const githubUsername = github ? extractGithubUsername(github) : "";
  const xUsername = xAccount ? extractXUsername(xAccount) : "";
  const linkedinSlug = linkedinAccount ? extractLinkedInSlug(linkedinAccount) : "";

  return (
    <section className="pr-identity" aria-label="Profile identity">
      <div
        className="pr-av-stack"
        style={{ ["--pct" as string]: completion.pct } as React.CSSProperties}
      >
        <span className="pr-ring" aria-hidden />
        {onEditAvatar && (
          <button
            type="button"
            className="pr-edit"
            onClick={onEditAvatar}
            aria-label="Change avatar"
          >
            <Plus size={14} />
          </button>
        )}
        <span className="pr-av" aria-hidden>
          {imageUrl ? (
            <Image src={imageUrl} alt="" width={104} height={104} unoptimized />
          ) : (
            inits
          )}
        </span>
      </div>

      <div className="pr-id-meta">
        <div className="pr-name-row">
          <h1>{fullName || "Add your name"}</h1>
          {handle && <span className="pr-handle">@{handle}</span>}
        </div>
        {bio && <div className="pr-bio">{bio}</div>}
        <div className="pr-chips">
          {teamLabel && (
            <span className="pr-chip pr-chip--avax">
              <span className="pr-dot" /> Team · {teamLabel}
            </span>
          )}
          {country && (
            <span className="pr-chip">
              <GlobeIcon size={11} /> {country}
            </span>
          )}
          {inviteShareUrl && (
            <InviteButton shareUrl={inviteShareUrl} onCopy={onInviteCopy} />
          )}
        </div>
        <div className="pr-pills">
          {email && (
            <a className="pr-pill-link" href={`mailto:${email}`} title={email}>
              <MailIcon size={13} /> {email}
            </a>
          )}
          {githubUsername && (
            <a
              className="pr-pill-link"
              href={`https://github.com/${githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`github.com/${githubUsername}`}
            >
              <GitHubIcon size={13} /> {githubUsername}
            </a>
          )}
          {telegram && (
            <a
              className="pr-pill-link"
              href={`https://t.me/${telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`@${telegram.replace(/^@/, "")}`}
            >
              <TelegramIcon size={13} /> @{telegram.replace(/^@/, "")}
            </a>
          )}
          {xUsername && xAccount && (
            <a
              className="pr-pill-link"
              href={xAccount}
              target="_blank"
              rel="noopener noreferrer"
              title={xAccount}
            >
              <XIcon size={11} /> {xUsername}
            </a>
          )}
          {linkedinSlug && linkedinAccount && (
            <a
              className="pr-pill-link"
              href={linkedinAccount}
              target="_blank"
              rel="noopener noreferrer"
              title={linkedinAccount}
            >
              <LinkedInIcon size={13} /> {linkedinSlug}
            </a>
          )}
          {links.map((link, i) => (
            <SitePill key={`${link.kind}-${i}`} link={link} />
          ))}
        </div>
      </div>

      <div className="pr-completion">
        <div className="pr-lbl">Profile strength</div>
        <div className="pr-big">
          {completion.pct}
          <span className="pr-gold">%</span>
        </div>
        <div className="pr-next">
          {next ? `Next: ${next.label}` : "You're all set ✦"}
        </div>
        <div className="pr-bar">
          <div style={{ width: `${completion.pct}%` }} />
        </div>
      </div>
    </section>
  );
}
