"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";

import "./styles.css";

import { useProfileForm } from "../components/hooks/useProfileForm";
import { useUserAvatar } from "@/components/context/UserAvatarContext";
import { NounAvatarConfig } from "../components/NounAvatarConfig";
import type { AvatarSeed } from "../components/DiceBearAvatar";

import { IdentityHero } from "./IdentityHero";
import { PersonalCard } from "./PersonalCard";
import { ProjectsCard } from "./ProjectsCard";
import { AchievementsCard } from "./AchievementsCard";
import { CompletionWidget } from "./CompletionWidget";
import { ReferralPanelShell } from "./ReferralPanelShell";
import { SaveBar } from "./SaveBar";
import { ToastHost, type ToastSpec } from "./Toast";
import {
  rolesFromValues,
  walletsFromValues,
  skillsFromValues,
  siteLinksFromValues,
  siteLinksToStringArray,
  roleFieldKey,
} from "./adapter";
import { computeCompletion, type CompletionStepKey } from "@/lib/profile/completion";
import { BADGES } from "./data";
import type { ProfileLink, ProfileRole } from "./types";

type Tab = "personal" | "projects" | "achievements" | "referrals";
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "personal", label: "Personal" },
  { id: "projects", label: "Projects" },
  { id: "achievements", label: "Achievements" },
  { id: "referrals", label: "Referrals" },
];

interface Props {
  achievements?: ReactNode;
  referralPanel?: ReactNode;
  teamLabel?: string | null;
}

export default function ProfilePage({ achievements, referralPanel, teamLabel }: Props) {
  const { data: session } = useSession();
  const avatarContext = useUserAvatar();
  const {
    form,
    watchedValues,
    isLoading,
    isSaving,
    githubConnected,
    setGithubConnected,
    xConnected,
    setXConnected,
    handleAddSkill,
    handleRemoveSkill,
    handleAddWallet,
    handleRemoveWallet,
    onSubmit,
  } = useProfileForm();

  const [tab, setTab] = React.useState<Tab>("personal");
  const [toasts, setToasts] = React.useState<ToastSpec[]>([]);
  const [isAvatarOpen, setIsAvatarOpen] = React.useState(false);
  const [nounAvatarSeed, setNounAvatarSeed] = React.useState<AvatarSeed | null>(null);
  const [nounAvatarEnabled, setNounAvatarEnabled] = React.useState(false);
  const personalCardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadNoun() {
      try {
        const res = await fetch("/api/user/noun-avatar");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const seed = data.seed ?? null;
        const enabled = data.enabled ?? false;
        setNounAvatarSeed(seed);
        setNounAvatarEnabled(enabled);
        avatarContext?.setNounAvatar(seed, enabled);
      } catch {
        /* noop */
      }
    }
    loadNoun();
    return () => {
      cancelled = true;
    };
  }, [avatarContext]);

  const pushToast = React.useCallback((message: string, kind: ToastSpec["kind"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  const setField = React.useCallback(
    (
      key: Parameters<typeof form.setValue>[0],
      value: Parameters<typeof form.setValue>[1],
    ) => {
      form.setValue(key, value, { shouldDirty: true });
    },
    [form],
  );

  // View-model derived from the live form state.
  const fullName = watchedValues.name ?? "";
  const handle = watchedValues.username ?? "";
  const bio = watchedValues.bio ?? "";
  const country = watchedValues.country ?? "";
  const github = watchedValues.github_account ?? "";
  const telegram = watchedValues.telegram_account ?? "";
  const xAccount = watchedValues.x_account ?? "";
  const linkedinAccount = watchedValues.linkedin_account ?? "";
  const skills = skillsFromValues(watchedValues);
  const wallets = walletsFromValues(watchedValues);
  const siteLinks = siteLinksFromValues(watchedValues);
  const roles = rolesFromValues(watchedValues);
  const imageUrl = watchedValues.image || null;
  const email = watchedValues.email || session?.user?.email || "";
  const completion = computeCompletion({
    fullName,
    bio,
    country,
    roles,
    github,
    wallets,
    skills,
    // TODO(profile-completion): wire engagement signals when data sources land.
    hasHackathonParticipation: false,
    hasProject: false,
    hasUsedConsole: false,
  });

  const dirty = form.formState.isDirty;

  const onToggleRole = (role: ProfileRole) => {
    const key = roleFieldKey(role) as Parameters<typeof form.setValue>[0];
    const currentValue = Boolean(form.getValues()[roleFieldKey(role) as keyof typeof watchedValues]);
    form.setValue(key, !currentValue as never, { shouldDirty: true });
  };

  const onSiteLinksChange = (next: ProfileLink[]) => {
    setField("additional_social_media" as never, siteLinksToStringArray(next) as never);
  };

  const onAddWalletAndToast = (address: string) => {
    handleAddWallet(address);
    pushToast("Wallet connected");
  };

  const onRemoveWallet = (address: string) => {
    const current = watchedValues.wallet ?? [];
    const idx = current.findIndex((w) => w.toLowerCase() === address.toLowerCase());
    if (idx >= 0) {
      handleRemoveWallet(idx);
      pushToast("Wallet removed");
    }
  };

  const onCopyWallet = () => pushToast("Address copied");

  const handleConnectGithub = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/github-link";
    }
  };

  const handleDisconnectGithub = async () => {
    try {
      await fetch("/api/auth/github-link/disconnect", { method: "DELETE" });
      setGithubConnected(false);
      form.setValue("github_account", "", { shouldDirty: false });
      pushToast("GitHub disconnected");
    } catch {
      pushToast("Could not disconnect GitHub", "error");
    }
  };

  const handleConnectX = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/x-link";
    }
  };

  const handleDisconnectX = async () => {
    try {
      await fetch("/api/auth/x-link/disconnect", { method: "DELETE" });
      setXConnected(false);
      form.setValue("x_account", "", { shouldDirty: false });
      pushToast("X disconnected");
    } catch {
      pushToast("Could not disconnect X", "error");
    }
  };

  const handleSave = async () => {
    try {
      await onSubmit();
      pushToast("Profile saved");
    } catch {
      pushToast("Could not save profile", "error");
    }
  };

  const handleDiscard = () => {
    form.reset();
    pushToast("Changes discarded");
  };

  const handleJump = (key: CompletionStepKey) => {
    if (tab !== "personal") setTab("personal");
    requestAnimationFrame(() => {
      personalCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const fieldId =
        key === "github"
          ? "pr-github"
          : key === "name"
            ? "pr-fullname"
            : key === "bio"
              ? "pr-bio"
              : null;
      if (fieldId) {
        const el = document.getElementById(fieldId) as HTMLElement | null;
        el?.focus({ preventScroll: true });
      }
    });
  };

  const handleNounAvatarSave = async (seed: AvatarSeed, enabled: boolean) => {
    setNounAvatarSeed(seed);
    setNounAvatarEnabled(enabled);
    avatarContext?.setNounAvatar(seed, enabled);
  };

  if (isLoading) {
    return (
      <div className="profile-redesign">
        <div className="pr-page">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 400,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "2px solid var(--pr-g-300)",
                  borderTopColor: "var(--pr-avax)",
                  animation: "pr-spin 0.9s linear infinite",
                  margin: "0 auto",
                }}
              />
              <p style={{ marginTop: 16, color: "var(--pr-g-700)" }}>Loading profile...</p>
              <style>{`@keyframes pr-spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-redesign">
      <div className="pr-page">
        <IdentityHero
          fullName={fullName}
          handle={handle}
          email={email}
          bio={bio}
          country={country}
          github={github}
          telegram={telegram}
          xAccount={xAccount}
          linkedinAccount={linkedinAccount}
          imageUrl={imageUrl}
          walletCount={wallets.length}
          teamLabel={teamLabel ?? null}
          links={siteLinks}
          completion={completion}
          onEditAvatar={() => setIsAvatarOpen(true)}
        />

        <div className="pr-tabbar">
          <div className="pr-tabs" role="tablist">
            {TABS.map((t) => {
              const count =
                t.id === "personal"
                  ? `${completion.completed}/${completion.total}`
                  : t.id === "achievements"
                    ? String(BADGES.filter((b) => b.unlocked).length)
                    : t.id === "projects"
                      ? "3"
                      : "·";
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`pr-tab${tab === t.id ? " pr-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label} <span className="pr-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="pr-grid"
          data-no-sidebar={completion.pct >= 100 ? "true" : undefined}
        >
          <div className="pr-col">
            {tab === "personal" && (
              <PersonalCard
                ref={personalCardRef}
                fullName={fullName}
                onFullNameChange={(v) => setField("name" as never, v as never)}
                bio={bio}
                onBioChange={(v) => setField("bio" as never, v as never)}
                country={country}
                onCountryChange={(v) => setField("country" as never, v as never)}
                roles={roles}
                onToggleRole={onToggleRole}
                github={github}
                onGithubChange={(v) =>
                  setField("github_account" as never, v as never)
                }
                githubConnected={githubConnected}
                onGithubConnect={handleConnectGithub}
                onGithubDisconnect={handleDisconnectGithub}
                telegram={telegram}
                onTelegramChange={(v) =>
                  setField("telegram_account" as never, v as never)
                }
                xAccount={xAccount}
                onXChange={(v) => setField("x_account" as never, v as never)}
                xConnected={xConnected}
                onXConnect={handleConnectX}
                onXDisconnect={handleDisconnectX}
                linkedinAccount={linkedinAccount}
                onLinkedinChange={(v) =>
                  setField("linkedin_account" as never, v as never)
                }
                siteLinks={siteLinks}
                onSiteLinksChange={onSiteLinksChange}
                wallets={wallets}
                onAddWallet={onAddWalletAndToast}
                onRemoveWallet={onRemoveWallet}
                onCopyWallet={onCopyWallet}
                skills={skills}
                onAddSkill={(s) => handleAddSkill(s, () => undefined)}
                onRemoveSkill={handleRemoveSkill}
              />
            )}
            {tab === "projects" && <ProjectsCard />}
            {tab === "achievements" &&
              (achievements ? (
                <div className="pr-card">
                  <div className="pr-body">{achievements}</div>
                </div>
              ) : (
                <AchievementsCard />
              ))}
            {tab === "referrals" && referralPanel && (
              <ReferralPanelShell panel={referralPanel} />
            )}
          </div>

          {completion.pct < 100 && (
            <div className="pr-col">
              <CompletionWidget completion={completion} onJump={handleJump} />
            </div>
          )}
        </div>

        <SaveBar
          visible={dirty}
          saving={isSaving}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      </div>

      <ToastHost toasts={toasts} />

      <NounAvatarConfig
        isOpen={isAvatarOpen}
        onOpenChange={setIsAvatarOpen}
        currentSeed={nounAvatarSeed}
        nounAvatarEnabled={nounAvatarEnabled}
        onSave={handleNounAvatarSave}
      />
    </div>
  );
}
