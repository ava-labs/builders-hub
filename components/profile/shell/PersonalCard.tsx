"use client";

import * as React from "react";
import { Settings, Check } from "lucide-react";
import { GitHubIcon, TelegramIcon, XIcon, LinkedInIcon } from "./icons";
import { RoleCard } from "./RoleCard";
import { CountrySelect } from "./CountrySelect";
import { SkillPicker } from "./SkillPicker";
import { WalletPanel } from "./WalletPanel";
import { LinksEditor } from "./LinksEditor";
import { ROLES } from "./data";
import {
  extractGithubUsername,
  extractXUsername,
  extractLinkedInSlug,
} from "./adapter";
import type { ProfileLink, ProfileRole, ProfileWallet } from "./types";
import { hsEmploymentRoles } from "@/constants/hs_employment_role";

const BIO_MAX = 240;

interface Props {
  fullName: string;
  onFullNameChange: (v: string) => void;
  bio: string;
  onBioChange: (v: string) => void;
  country: string;
  onCountryChange: (v: string) => void;
  roles: ProfileRole[];
  onToggleRole: (id: ProfileRole) => void;
  studentInstitution: string;
  onStudentInstitutionChange: (v: string) => void;
  founderCompany: string;
  onFounderCompanyChange: (v: string) => void;
  employeeCompany: string;
  onEmployeeCompanyChange: (v: string) => void;
  employeeRole: string;
  onEmployeeRoleChange: (v: string) => void;
  github: string;
  onGithubChange: (v: string) => void;
  githubConnected: boolean;
  onGithubConnect: () => void;
  onGithubDisconnect: () => void;
  telegram: string;
  onTelegramChange: (v: string) => void;
  xAccount: string;
  xConnected: boolean;
  onXConnect: () => void;
  onXDisconnect: () => void;
  linkedinAccount: string;
  /** Receives the rebuilt full URL (or empty when cleared). */
  onLinkedinChange: (url: string) => void;
  siteLinks: ProfileLink[];
  onSiteLinksChange: (links: ProfileLink[]) => void;
  wallets: ProfileWallet[];
  onAddWallet: (address: string, tag?: string, signature?: string, issuedAt?: string, nonce?: string) => void;
  onRemoveWallet: (address: string) => void;
  skills: string[];
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
}

export const PersonalCard = React.forwardRef<HTMLDivElement, Props>(function PersonalCard(
  props,
  ref,
) {
  const {
    fullName,
    onFullNameChange,
    bio,
    onBioChange,
    country,
    onCountryChange,
    roles,
    onToggleRole,
    studentInstitution,
    onStudentInstitutionChange,
    founderCompany,
    onFounderCompanyChange,
    employeeCompany,
    onEmployeeCompanyChange,
    employeeRole,
    onEmployeeRoleChange,
    github,
    onGithubChange,
    githubConnected,
    onGithubConnect,
    onGithubDisconnect,
    telegram,
    onTelegramChange,
    xAccount,
    xConnected,
    onXConnect,
    onXDisconnect,
    linkedinAccount,
    onLinkedinChange,
    siteLinks,
    onSiteLinksChange,
    wallets,
    onAddWallet,
    onRemoveWallet,
    skills,
    onAddSkill,
    onRemoveSkill,
  } = props;

  const githubDisplay = extractGithubUsername(github);
  const xDisplay = extractXUsername(xAccount);
  const linkedinDisplay = extractLinkedInSlug(linkedinAccount);

  return (
    <div className="pr-card" ref={ref}>
      <div className="pr-head">
        <div className="pr-ico">
          <Settings size={18} />
        </div>
        <div>
          <h3>Personal</h3>
          <div className="pr-desc">
            Complete your profile to unlock badges, grants and tailored opportunities.
          </div>
        </div>
      </div>

      <div className="pr-body">
        <div className="pr-field">
          <label htmlFor="pr-fullname">
            Full name <span className="pr-req">*</span>
          </label>
          <input
            id="pr-fullname"
            className="pr-input"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
          />
          <div className="pr-helper">
            <span>Shown across the Avalanche Builder Hub.</span>
          </div>
        </div>

        <div className="pr-field">
          <label htmlFor="pr-bio">
            Short bio{" "}
            <span className="pr-opt">— a sentence or two about what you build.</span>
          </label>
          <textarea
            id="pr-bio"
            className="pr-input"
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
            maxLength={BIO_MAX}
            placeholder="Developer Relations for Ava Labs. Building education programs for Avalanche L1s."
          />
          <div className="pr-helper">
            <span>Markdown supported · keep it punchy.</span>
            <span style={{ fontFamily: "var(--pr-mono)" }}>
              {bio.length}/{BIO_MAX}
            </span>
          </div>
        </div>

        <div className="pr-field">
          <label>Country</label>
          <CountrySelect value={country} onChange={onCountryChange} />
        </div>

        <div className="pr-field">
          <label>What roles describe you?</label>
          <div className="pr-role-grid" role="group" aria-label="Roles">
            {ROLES.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                selected={roles.includes(role.id)}
                onToggle={onToggleRole}
              />
            ))}
          </div>
          {(roles.includes("university") ||
            roles.includes("founder") ||
            roles.includes("employee")) && (
            <div className="pr-role-details">
              {roles.includes("university") && (
                <div className="pr-input-group">
                  <span className="pr-pre">University</span>
                  <input
                    value={studentInstitution}
                    onChange={(e) => onStudentInstitutionChange(e.target.value)}
                    placeholder="Institution name"
                    aria-label="University or institution"
                  />
                </div>
              )}
              {roles.includes("founder") && (
                <div className="pr-input-group">
                  <span className="pr-pre">Company</span>
                  <input
                    value={founderCompany}
                    onChange={(e) => onFounderCompanyChange(e.target.value)}
                    placeholder="Company name"
                    aria-label="Founder company name"
                  />
                </div>
              )}
              {roles.includes("employee") && (
                <>
                  <div className="pr-input-group">
                    <span className="pr-pre">Company</span>
                    <input
                      value={employeeCompany}
                      onChange={(e) => onEmployeeCompanyChange(e.target.value)}
                      placeholder="Company name"
                      aria-label="Employer company name"
                    />
                  </div>
                  <div className="pr-input-group">
                    <span className="pr-pre">Role</span>
                    <select
                      value={employeeRole}
                      onChange={(e) => onEmployeeRoleChange(e.target.value)}
                      aria-label="Employment role"
                    >
                      <option value="">Select a role…</option>
                      {hsEmploymentRoles.map((r) => (
                        <option key={r.value} value={r.label}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Socials — 2x2 grid, icon-only labels.
            Row 1: GitHub | X (both account-link flows)
            Row 2: Telegram | LinkedIn (freeform) */}
        <div className="pr-field-row">
          <div className="pr-field">
            <label htmlFor="pr-github">
              <GitHubIcon size={16} />
              <span className="pr-sr-only">GitHub</span>
            </label>
            <div className="pr-social-row">
              <div className="pr-input-group" style={{ flex: 1, minWidth: 0 }}>
                <span className="pr-pre">github.com/</span>
                <input
                  id="pr-github"
                  value={githubDisplay}
                  onChange={(e) => onGithubChange(e.target.value.trim())}
                  placeholder="username"
                  disabled={githubConnected}
                />
              </div>
              {githubConnected ? (
                <button
                  type="button"
                  className="pr-btn pr-btn--success"
                  onClick={onGithubDisconnect}
                >
                  <Check size={14} /> Connected
                </button>
              ) : (
                <button
                  type="button"
                  className="pr-btn pr-btn--outline"
                  onClick={onGithubConnect}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
          <div className="pr-field">
            <label htmlFor="pr-x">
              <XIcon size={14} />
              <span className="pr-sr-only">X</span>
            </label>
            <div className="pr-social-row">
              <div className="pr-input-group" style={{ flex: 1, minWidth: 0 }}>
                <span className="pr-pre">x.com/</span>
                <input
                  id="pr-x"
                  value={xDisplay}
                  placeholder="username"
                  disabled
                  readOnly
                />
              </div>
              {xConnected ? (
                <button
                  type="button"
                  className="pr-btn pr-btn--success"
                  onClick={onXDisconnect}
                >
                  <Check size={14} /> Connected
                </button>
              ) : (
                <button
                  type="button"
                  className="pr-btn pr-btn--outline"
                  onClick={onXConnect}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pr-field-row">
          <div className="pr-field">
            <label htmlFor="pr-telegram">
              <TelegramIcon size={16} />
              <span className="pr-sr-only">Telegram</span>
            </label>
            <div className="pr-input-group">
              <span className="pr-pre">@</span>
              <input
                id="pr-telegram"
                value={telegram}
                onChange={(e) => onTelegramChange(e.target.value)}
                placeholder="username"
              />
            </div>
          </div>
          <div className="pr-field">
            <label htmlFor="pr-linkedin">
              <LinkedInIcon size={16} />
              <span className="pr-sr-only">LinkedIn</span>
            </label>
            <div className="pr-input-group">
              <span className="pr-pre">linkedin.com/in/</span>
              <input
                id="pr-linkedin"
                value={linkedinDisplay}
                onChange={(e) => {
                  const slug = e.target.value.trim().replace(/^\/+|\/+$/g, "");
                  onLinkedinChange(slug ? `https://linkedin.com/in/${slug}` : "");
                }}
                placeholder="username"
              />
            </div>
          </div>
        </div>

        <div className="pr-field">
          <label>
            Other socials{" "}
            <span className="pr-opt">— personal site or other URLs</span>
          </label>
          <LinksEditor links={siteLinks} onChange={onSiteLinksChange} />
        </div>

        <div className="pr-field">
          <label>Your wallet</label>
          <WalletPanel
            wallets={wallets}
            onAddWallet={onAddWallet}
            onRemove={onRemoveWallet}
          />
        </div>

        <div className="pr-field">
          <label>Skills & expertise</label>
          <SkillPicker
            skills={skills}
            onAdd={onAddSkill}
            onRemove={onRemoveSkill}
          />
        </div>
      </div>
    </div>
  );
});
