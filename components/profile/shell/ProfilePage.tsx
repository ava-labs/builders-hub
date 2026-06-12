"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import { toast as sonnerToast } from "sonner";

import SignOutComponent from "@/components/login/sign-out/SignOut";

import "./styles.css";

import { useProfileForm } from "../components/hooks/useProfileForm";
import { useUserAvatar } from "@/components/context/UserAvatarContext";
import { NounAvatarConfig } from "../components/NounAvatarConfig";
import type { AvatarSeed } from "../components/DiceBearAvatar";

import { MailIcon } from "./icons";
import { IdentityHero } from "./IdentityHero";
import { PersonalCard } from "./PersonalCard";
import { ProjectsCard, type ProjectsCardProject } from "./ProjectsCard";
import { MyDecksCard } from "./MyDecksCard";
import { AchievementsCard, type AchievementsCardBadge } from "./AchievementsCard";
import { SettingsCard } from "./SettingsCard";
import { PlaygroundsCard, type PlaygroundListItem } from "./PlaygroundsCard";
import { CompletionWidget } from "./CompletionWidget";
import {
  ReferralPanel,
  type ReferralPanelLink,
  type ReferralPanelTarget,
} from "@/components/referrals/ReferralPanel";
import { SaveBar } from "./SaveBar";
import {
  rolesFromValues,
  walletsFromValues,
  skillsFromValues,
  siteLinksFromValues,
  siteLinksToStringArray,
  roleFieldKey,
} from "./adapter";
import { computeCompletion, type CompletionStepKey } from "@/lib/profile/completion";
import {
  canAccessBuilderInsights,
  canSendNotifications,
} from "@/lib/auth/permissions";
import SendNotificationsForm from "@/components/notification/send-notifications-form";
import { InsightsCard } from "./InsightsCard";
import type { BuilderInsightsData } from "@/server/services/builderInsights";
import type { ProfileLink, ProfileRole } from "./types";

type Tab =
  | "personal"
  | "projects"
  | "decks"
  | "achievements"
  | "settings"
  | "playground"
  | "insights"
  | "notifications";
interface TabSpec {
  id: Tab;
  label: string;
}
const BASE_TABS: ReadonlyArray<TabSpec> = [
  { id: "personal", label: "Personal" },
  { id: "projects", label: "Projects" },
  { id: "decks", label: "My Decks" },
  { id: "achievements", label: "Achievements" },
  { id: "playground", label: "Playground" },
  { id: "settings", label: "Settings" },
];

interface SummaryReferralLink {
  id: string;
  code: string;
  shareUrl: string;
  signups: number;
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
}

interface SummaryReferralTarget {
  key: string;
  group: "signup" | "event" | "grant";
  label: string;
  detail: string;
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
  icon: "rocket" | "trophy" | "code" | "gift";
}

interface SummaryResponse {
  projects: ProjectsCardProject[];
  badges: AchievementsCardBadge[];
  engagement: {
    hasProject: boolean;
    hasHackathonParticipation: boolean;
    hasUsedConsole: boolean;
  };
  referralCount: number;
  bhSignupCode: string | null;
  bhSignupShareUrl: string | null;
  referralLinks: SummaryReferralLink[];
  referralTargets: SummaryReferralTarget[];
  totalBuilders: number;
  origin: string;
}

const EMPTY_SUMMARY: SummaryResponse = {
  projects: [],
  badges: [],
  engagement: {
    hasProject: false,
    hasHackathonParticipation: false,
    hasUsedConsole: false,
  },
  referralCount: 0,
  bhSignupCode: null,
  bhSignupShareUrl: null,
  referralLinks: [],
  referralTargets: [],
  totalBuilders: 0,
  origin: "",
};

interface Props {
  teamLabel?: string | null;
}

export default function ProfilePage({ teamLabel }: Props) {
  const { data: session } = useSession();
  const avatarContext = useUserAvatar();
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const {
    form,
    watchedValues,
    isLoading,
    isSaving,
    githubConnected,
    setGithubConnected,
    handleAddSkill,
    handleRemoveSkill,
    handleAddWallet,
    handleRemoveWallet,
    onSubmit,
  } = useProfileForm();

  const [tab, setTab] = React.useState<Tab>("personal");
  const [deckCount, setDeckCount] = React.useState<number>(0);
  const [isAvatarOpen, setIsAvatarOpen] = React.useState(false);
  const [nounAvatarSeed, setNounAvatarSeed] = React.useState<AvatarSeed | null>(null);
  const [nounAvatarEnabled, setNounAvatarEnabled] = React.useState(false);
  const [summary, setSummary] = React.useState<SummaryResponse>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);
  const [playgrounds, setPlaygrounds] = React.useState<PlaygroundListItem[]>([]);
  const [playgroundsLoading, setPlaygroundsLoading] = React.useState(true);
  const [insightsData, setInsightsData] = React.useState<BuilderInsightsData | null>(
    null,
  );
  const [insightsLoading, setInsightsLoading] = React.useState(false);
  const [insightsError, setInsightsError] = React.useState<string | null>(null);
  const personalCardRef = React.useRef<HTMLDivElement>(null);
  const showInsightsTab = canAccessBuilderInsights(
    session?.user?.custom_attributes,
  );

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

  React.useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;
    setSummaryLoading(true);
    fetch("/api/profile/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: SummaryResponse) => {
        if (cancelled) return;
        setSummary(data);
      })
      .catch((err) => {
        console.error("[ProfilePage] failed to load summary:", err);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Saved playground dashboards (the user's own). Lightweight list — the heavy
  // chart data only loads when a row is expanded in the Playground tab.
  React.useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;
    setPlaygroundsLoading(true);
    fetch("/api/playground")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: PlaygroundListItem[]) => {
        if (cancelled) return;
        setPlaygrounds(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("[ProfilePage] failed to load playgrounds:", err);
      })
      .finally(() => {
        if (!cancelled) setPlaygroundsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Builder Insights is heavy (PostHog HogQL queries take a few seconds each),
  // so we lazy-load it in the background only for DevRel users who have the
  // `builder_insights` attribute. Tab is hidden for everyone else.
  React.useEffect(() => {
    if (!showInsightsTab) return;
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    fetch("/api/profile/insights")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: BuilderInsightsData) => {
        if (cancelled) return;
        setInsightsData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[ProfilePage] failed to load insights:", err);
        setInsightsError("Could not load Builder Insights right now.");
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showInsightsTab]);

  const pushToast = React.useCallback((message: string, kind: "success" | "error" = "success") => {
    if (kind === "error") {
      sonnerToast.error(message);
      return;
    }
    sonnerToast.success(message);
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
  const studentInstitution = watchedValues.student_institution ?? "";
  const founderCompany = watchedValues.founder_company_name ?? "";
  const employeeCompany = watchedValues.employee_company_name ?? "";
  const employeeRole = watchedValues.employee_role ?? "";
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
    xAccount,
    telegram,
    linkedin: linkedinAccount,
    wallets,
    skills,
    hasHackathonParticipation: summary.engagement.hasHackathonParticipation,
    hasProject: summary.engagement.hasProject,
    hasUsedConsole: summary.engagement.hasUsedConsole,
  });

  const dirty = form.formState.isDirty;

  const onToggleRole = (role: ProfileRole) => {
    const key = roleFieldKey(role) as Parameters<typeof form.setValue>[0];
    const currentValue = Boolean(form.getValues()[roleFieldKey(role) as keyof typeof watchedValues]);
    const nextValue = !currentValue;
    form.setValue(key, nextValue as never, { shouldDirty: true });
    // Clear the role-specific detail fields when the role is turned off so we
    // don't leak stale "Acme Inc / Engineering" data into a user_type that no
    // longer claims that role.
    if (!nextValue) {
      if (role === "university") {
        form.setValue("student_institution" as never, "" as never, { shouldDirty: true });
      } else if (role === "founder") {
        form.setValue("founder_company_name" as never, "" as never, { shouldDirty: true });
      } else if (role === "employee") {
        form.setValue("employee_company_name" as never, "" as never, { shouldDirty: true });
        form.setValue("employee_role" as never, "" as never, { shouldDirty: true });
      }
    }
  };

  const onSiteLinksChange = (next: ProfileLink[]) => {
    setField(
      "additional_social_accounts" as never,
      siteLinksToStringArray(next) as never,
    );
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
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/api/auth/x-link?returnTo=${encodeURIComponent(returnTo)}`;
    }
  };

  const handleDisconnectX = async () => {
    try {
      await fetch("/api/auth/x-link/disconnect", { method: "DELETE" });
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
          : key === "x"
            ? "pr-x"
            : key === "telegram"
              ? "pr-telegram"
              : key === "linkedin"
                ? "pr-linkedin"
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

  const handleSignOutConfirm = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("redirectAfterProfile");
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("formData_")) localStorage.removeItem(key);
      });
    }
    await signOut({ redirect: false });
    window.location.href = "/";
  };

  const handleNounAvatarSave = async (seed: AvatarSeed, enabled: boolean) => {
    setNounAvatarSeed(seed);
    setNounAvatarEnabled(enabled);
    avatarContext?.setNounAvatar(seed, enabled);
  };

  // Map server-side referral data into the ReferralPanel's view-model.
  // IMPORTANT: useMemo must run on every render — keep these above any
  // early-return below or React throws a hooks-order error.
  const referralCatalog: ReferralPanelTarget[] = React.useMemo(
    () =>
      summary.referralTargets.map((t) => ({
        key: t.key,
        label: t.label,
        detail: t.detail,
        targetType: t.targetType,
        targetId: t.targetId,
        destinationUrl: t.destinationUrl,
        icon: t.icon,
      })),
    [summary.referralTargets],
  );

  const referralLinks: ReferralPanelLink[] = React.useMemo(() => {
    const targetByKey = new Map<string, SummaryReferralTarget>();
    for (const t of summary.referralTargets) {
      targetByKey.set(`${t.targetType}|${t.targetId ?? ""}`, t);
    }
    return summary.referralLinks.map((l) => {
      const sig = `${l.targetType}|${l.targetId ?? ""}`;
      const t = targetByKey.get(sig);
      return {
        id: l.id,
        shareUrl: l.shareUrl,
        signups: l.signups,
        targetType: l.targetType,
        targetId: l.targetId,
        targetLabel: t?.label ?? l.targetType.replace(/_/g, " "),
        targetIcon: t?.icon ?? "rocket",
      };
    });
  }, [summary.referralLinks, summary.referralTargets]);

  if (isLoading) {
    return (
      <div className="profile">
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

  const showNotificationsTab = canSendNotifications(session?.user?.custom_attributes);
  const tabs: ReadonlyArray<TabSpec> = [
    ...BASE_TABS,
    ...(showInsightsTab ? [{ id: "insights" as const, label: "Insights" }] : []),
    ...(showNotificationsTab
      ? [{ id: "notifications" as const, label: "Notifications" }]
      : []),
  ];

  const tabCounts: Record<Tab, number | null> = {
    personal:
      completion.completed === completion.total ? null : completion.completed,
    projects: summary.projects.length,
    decks: deckCount,
    achievements: summary.badges.filter((badge) => badge.isUnlocked).length,
    settings: null,
    playground: playgrounds.length || null,
    insights: insightsData?.latest30DaySignups ?? null,
    notifications: null,
  };

  const showSidebar =
    completion.pct < 100 || referralLinks.length > 0 || referralCatalog.length > 0;

  return (
    <div className="profile">
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
          inviteShareUrl={summary.bhSignupShareUrl}
          onInviteCopy={() => pushToast("Invite link copied")}
          onEditAvatar={() => setIsAvatarOpen(true)}
          onSignOut={() => setSignOutOpen(true)}
        />

        <div className="pr-tabbar">
          <div className="pr-tabs" role="tablist">
            {tabs.map((t) => {
              const count = tabCounts[t.id];
              const showCount =
                t.id === "personal"
                  ? count !== null
                  : typeof count === "number" && count > 0;
              const display =
                t.id === "personal"
                  ? `${completion.completed}/${completion.total}`
                  : count != null
                    ? count.toLocaleString()
                    : "";
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`pr-tab${tab === t.id ? " pr-active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.id === "insights" ? (
                    <span className="pr-devrel-badge">Team</span>
                  ) : t.id === "notifications" ? (
                    <span className="pr-devrel-badge">DevRel</span>
                  ) : (
                    showCount && <span className="pr-count">{display}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="pr-grid"
          data-no-sidebar={!showSidebar ? "true" : undefined}
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
                studentInstitution={studentInstitution}
                onStudentInstitutionChange={(v) =>
                  setField("student_institution" as never, v as never)
                }
                founderCompany={founderCompany}
                onFounderCompanyChange={(v) =>
                  setField("founder_company_name" as never, v as never)
                }
                employeeCompany={employeeCompany}
                onEmployeeCompanyChange={(v) =>
                  setField("employee_company_name" as never, v as never)
                }
                employeeRole={employeeRole}
                onEmployeeRoleChange={(v) =>
                  setField("employee_role" as never, v as never)
                }
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
                xConnected={Boolean(xAccount)}
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
                skills={skills}
                onAddSkill={(s) => handleAddSkill(s, () => undefined)}
                onRemoveSkill={handleRemoveSkill}
              />
            )}
            {tab === "projects" && (
              <ProjectsCard
                projects={summary.projects}
                loading={summaryLoading}
              />
            )}
            {tab === "decks" && (
              <MyDecksCard onCountChange={setDeckCount} />
            )}
            {tab === "achievements" && (
              <AchievementsCard
                badges={summary.badges}
                loading={summaryLoading}
              />
            )}
            {tab === "settings" && <SettingsCard />}
            {tab === "playground" && (
              <PlaygroundsCard
                playgrounds={playgrounds}
                loading={playgroundsLoading}
              />
            )}
            {tab === "insights" && showInsightsTab && (
              <InsightsCard
                data={insightsData}
                loading={insightsLoading}
                error={insightsError}
              />
            )}
            {tab === "notifications" && showNotificationsTab && (
              <div className="pr-card">
                <div className="pr-head">
                  <div
                    className="pr-ico"
                    style={{
                      background: "var(--pr-primary-light)",
                      color: "var(--pr-accent-main)",
                    }}
                  >
                    <MailIcon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>Send notifications</h3>
                    <div className="pr-desc">
                      Compose and broadcast to all builders, hackathon cohorts,
                      or a custom email list.
                    </div>
                  </div>
                  <span className="pr-insights__devrel-pill">DevRel only</span>
                </div>
                <div className="pr-notifications-body">
                  <SendNotificationsForm
                    totalBuilders={summary.totalBuilders}
                    hideHeader
                  />
                </div>
              </div>
            )}
          </div>

          {showSidebar && (
            <div className="pr-col">
              {tab === "personal" && completion.pct < 100 && (
                <CompletionWidget completion={completion} onJump={handleJump} />
              )}
              <ReferralPanel
                links={referralLinks}
                targets={referralCatalog}
                totalSignups={summary.referralCount}
                loading={summaryLoading}
                onCreate={async (target) => {
                  try {
                    const res = await fetch("/api/referrals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        targetType: target.targetType,
                        targetId: target.targetId,
                        destinationUrl: target.destinationUrl,
                      }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const link = await res.json();
                    setSummary((prev) => ({
                      ...prev,
                      referralLinks: [
                        ...prev.referralLinks,
                        {
                          id: link.id,
                          code: link.code,
                          shareUrl: link.shareUrl,
                          signups: 0,
                          targetType: link.target_type,
                          targetId: link.target_id ?? null,
                          destinationUrl: link.destination_url,
                        },
                      ],
                    }));
                    pushToast("Referral link created");
                  } catch (err) {
                    console.error("[ProfilePage] failed to create link:", err);
                    pushToast("Could not create referral link", "error");
                  }
                }}
                onCopy={() => pushToast("Referral link copied")}
              />
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
      <NounAvatarConfig
        isOpen={isAvatarOpen}
        onOpenChange={setIsAvatarOpen}
        currentSeed={nounAvatarSeed}
        nounAvatarEnabled={nounAvatarEnabled}
        onSave={handleNounAvatarSave}
      />
      <SignOutComponent
        isOpen={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={handleSignOutConfirm}
      />
    </div>
  );
}
