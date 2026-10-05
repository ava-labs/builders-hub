"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { toast as sonnerToast } from "sonner";

import SheetBackdrop from "@/components/landing-v2/SheetBackdrop";
import SignOutComponent from "@/components/login/sign-out/SignOut";
import SendNotificationsForm from "@/components/notification/send-notifications-form";
import { triggerNewUserLogin, useLoginModalTrigger } from "@/hooks/useLoginModal";
import { canAccessBuilderInsights, canSendNotifications } from "@/lib/auth/permissions";
import { computeCompletion, type CompletionStepKey } from "@/lib/profile/completion";
import type { BuilderInsightsData } from "@/server/services/builderInsights";

import "./styles.css";

import { useProfileForm, type ProfileFormValues } from "../components/hooks/useProfileForm";
import { AccountsSection } from "../sections/AccountsSection";
import { AchievementsSection, type AcademyProgress, type AchievementBadge } from "../sections/AchievementsSection";
import { AlertsSection } from "../sections/AlertsSection";
import { ConsoleHistorySection } from "../sections/ConsoleHistorySection";
import { PersonalSection } from "../sections/PersonalSection";
import { ProjectsSection } from "../sections/ProjectsSection";
import { QuerySection } from "../sections/QuerySection";
import { ReferralsSection } from "../sections/ReferralsSection";
import { SettingsSection } from "../sections/SettingsSection";
import type { ProfileProject, ReferralLink, ReferralTarget } from "../sections/types";
import { Button, ErrorLine, Group, SectionHeader, scrollBehavior } from "../ui";
import { InsightsCard } from "./InsightsCard";
import { Identity, ProfileRail, ProfileTabs, sectionHref, type SectionId, type SectionSpec } from "./ProfileNav";
import { SaveBar } from "./SaveBar";
import { rolesFromValues, skillsFromValues, walletsFromValues } from "./adapter";

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
  projects: ProfileProject[];
  badges: AchievementBadge[];
  academy: AcademyProgress | null;
  engagement: { hasProject: boolean; hasHackathonParticipation: boolean; hasUsedConsole: boolean };
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
  academy: null,
  engagement: { hasProject: false, hasHackathonParticipation: false, hasUsedConsole: false },
  referralCount: 0,
  bhSignupCode: null,
  bhSignupShareUrl: null,
  referralLinks: [],
  referralTargets: [],
  totalBuilders: 0,
  origin: "",
};

/** where each completion step is filled in */
const STEP_SECTION: Partial<Record<CompletionStepKey, { section: SectionId; field?: string }>> = {
  name: { section: "personal", field: "pr-name" },
  bio: { section: "personal", field: "pr-bio" },
  country: { section: "personal", field: "pr-country" },
  roles: { section: "personal", field: "pr-role-developer" },
  skills: { section: "personal", field: "pr-skill" },
  github: { section: "accounts" },
  x: { section: "accounts" },
  telegram: { section: "accounts", field: "pr-telegram" },
  linkedin: { section: "accounts", field: "pr-linkedin" },
  wallet: { section: "accounts" },
  hackathon: { section: "projects" },
  project: { section: "projects" },
  console: { section: "console" },
};

/** the sections with form fields: the save bar belongs to them */
const FORM_SECTIONS: ReadonlyArray<SectionId> = ["personal", "accounts"];

/** the form fields that Connected accounts holds; Personal info holds the rest */
const ACCOUNT_FIELDS: ReadonlySet<string> = new Set<keyof ProfileFormValues>([
  "telegram_account",
  "linkedin_account",
  "wallet",
  "additional_social_accounts",
  "github_account",
  "x_account",
]);

function sectionOfField(field: string): SectionId {
  return ACCOUNT_FIELDS.has(field) ? "accounts" : "personal";
}

export default function ProfilePage({ teamLabel }: { teamLabel?: string | null }) {
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  // only the first load: a session update (after a photo change) is
  // "loading" too, and must not unmount the page and its unsaved edits
  if (status === "loading" && !session) {
    return (
      <ProfileFrame>
        <PageSpinner />
      </ProfileFrame>
    );
  }
  if ((status !== "authenticated" && !session) || !session?.user?.id) {
    return (
      <ProfileFrame>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="v2-heading text-[24px] text-zinc-900 dark:text-zinc-50">Sign in to see your profile</h1>
          <Button variant="primary" className="mt-6" onClick={() => openLoginModal()}>
            Sign in
          </Button>
        </div>
      </ProfileFrame>
    );
  }
  // Signup is not done until the user accepts the terms. A pending account
  // has no profile yet, so the page shows only the way back to the terms.
  const { id: userId, email } = session.user;
  if (userId.startsWith("pending_")) {
    return (
      <ProfileFrame>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="v2-heading text-[24px] text-zinc-900 dark:text-zinc-50">Accept the terms to finish your signup</h1>
          <Button
            variant="primary"
            className="mt-6"
            onClick={() => triggerNewUserLogin({ userId, email, isNewUser: true })}
          >
            Accept the terms
          </Button>
        </div>
      </ProfileFrame>
    );
  }
  return <SignedInProfile teamLabel={teamLabel ?? null} />;
}

/* the sheet every state of the page sits on: the site's 90rem column
   between hairline rules, on the lattice backdrop */
function ProfileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white dark:bg-zinc-950">
      <SheetBackdrop snowOnly />
      <div className="relative mx-auto min-h-screen w-full max-w-[90rem] border-x border-transparent bg-white px-5 pb-24 pt-10 md:px-6 min-[90rem]:border-zinc-200/90 dark:bg-zinc-950 dark:min-[90rem]:border-zinc-800/90">
        {children}
      </div>
    </div>
  );
}

function PageSpinner() {
  return (
    <div role="status" className="flex min-h-[400px] items-center justify-center">
      <span aria-hidden className="h-8 w-8 animate-spin border-2 border-zinc-200 border-t-[#E6212F] dark:border-zinc-800" />
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}

function SignedInProfile({ teamLabel }: { teamLabel: string | null }) {
  const { data: session, update: updateSession } = useSession();
  const userId = session?.user?.id ?? null;
  const searchParams = useSearchParams();
  const { form, isLoading, loadFailed, reload, isSaving, githubConnected, setGithubConnected, save } = useProfileForm();
  const values = form.watch();
  const dirty = form.formState.isDirty;

  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<SummaryResponse>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = React.useState(true);
  const [summaryFailed, setSummaryFailed] = React.useState(false);
  const [insightsData, setInsightsData] = React.useState<BuilderInsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = React.useState(false);
  const [insightsError, setInsightsError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // true once the user confirmed that the page goes away: the leave guards stand down
  const leavingRef = React.useRef(false);
  // the control that opened a dialog: it gets the focus back when the dialog closes
  const openerRef = React.useRef<HTMLElement | null>(null);

  // a clean form has no failed save to report
  if (!dirty && saveError) setSaveError(null);

  const showInsights = canAccessBuilderInsights(session?.user?.custom_attributes);
  const showNotifications = canSendNotifications(session?.user?.custom_attributes);

  /* ------------------------------------------------------------ data */

  const summaryRun = React.useRef(0);
  const loadSummary = React.useCallback(() => {
    if (!userId) return;
    const run = ++summaryRun.current;
    setSummaryLoading(true);
    setSummaryFailed(false);
    fetch("/api/profile/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: SummaryResponse) => {
        if (run === summaryRun.current) setSummary({ ...EMPTY_SUMMARY, ...data });
      })
      .catch(() => {
        if (run === summaryRun.current) setSummaryFailed(true);
      })
      .finally(() => {
        if (run === summaryRun.current) setSummaryLoading(false);
      });
  }, [userId]);
  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  /* -------------------------------------------------------- sections */
  const completion = computeCompletion({
    fullName: values.name,
    bio: values.bio,
    country: values.country,
    roles: rolesFromValues(values),
    github: githubConnected ? values.github_account : "",
    xAccount: values.x_account,
    telegram: values.telegram_account,
    linkedin: values.linkedin_account,
    wallets: walletsFromValues(values),
    skills: skillsFromValues(values),
    hasHackathonParticipation: summary.engagement.hasHackathonParticipation,
    hasProject: summary.engagement.hasProject,
    hasUsedConsole: summary.engagement.hasUsedConsole,
  });

  const sections: SectionSpec[] = [
    { id: "personal", label: "Personal info", group: "Account" },
    { id: "accounts", label: "Connected accounts", group: "Account" },
    { id: "referrals", label: "Referrals", group: "Account", count: summary.referralCount },
    { id: "settings", label: "Settings", group: "Account" },
    { id: "projects", label: "Projects", group: "Activity", count: summary.projects.length },
    {
      id: "achievements",
      label: "Achievements",
      group: "Activity",
      count: summary.badges.filter((b) => b.isUnlocked).length,
    },
    { id: "console", label: "Console history", group: "Activity" },
    { id: "query", label: "Query", group: "Activity" },
    { id: "alerts", label: "Alerts", group: "Activity" },
    ...(showInsights ? [{ id: "insights" as const, label: "Insights", group: "Team" as const }] : []),
    ...(showNotifications
      ? [{ id: "notifications" as const, label: "Send notifications", group: "Team" as const }]
      : []),
  ];

  // The URL names the section. An OAuth link return (?gh=, ?x=) opens the
  // accounts it changed; an unknown or hidden section opens Personal info.
  const requested = searchParams.get("tab");
  const linkReturn = searchParams.has("gh") || searchParams.has("x");
  const active: SectionId = linkReturn ? "accounts" : (sections.find((s) => s.id === requested)?.id ?? "personal");

  // the focus goes to the top of the section, for a screen reader and a
  // keyboard user
  const focusSectionTop = React.useCallback(() => {
    const heading = contentRef.current?.querySelector<HTMLElement>("#section-title");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, []);

  const select = React.useCallback(
    (id: SectionId, e?: React.MouseEvent<HTMLAnchorElement>) => {
      // a new tab or window keeps the browser's own behavior
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
      e?.preventDefault();
      const href = sectionHref(id);
      // the open section: no second history entry
      if (window.location.pathname + window.location.search === href) {
        focusSectionTop();
        return;
      }
      // null, not history.state: the app router syncs the URL only then
      window.history.pushState(null, "", href);
    },
    [focusSectionTop],
  );

  // A new section takes the focus to its heading, so a screen reader and a
  // keyboard user start at its top; the page scrolls up to it if needed.
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = contentRef.current?.querySelector<HTMLElement>("#section-title");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    const top = contentRef.current?.getBoundingClientRect().top ?? 0;
    // under the site navbar (3.5rem) counts as out of view
    if (top < 56) window.scrollTo({ top: window.scrollY + top - 88, behavior: scrollBehavior() });
  }, [active]);

  // Insights is heavy (Postgres and PostHog fan-out): it loads when opened.
  React.useEffect(() => {
    if (!showInsights || active !== "insights" || insightsData) return;
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    fetch("/api/profile/insights")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: BuilderInsightsData) => {
        if (!cancelled) setInsightsData(data);
      })
      .catch(() => {
        if (!cancelled) setInsightsError("Could not load Builder Insights.");
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showInsights, active, insightsData]);

  // Unsaved edits: the browser asks before the page goes away, and a click on
  // a link to another page of the site asks first. beforeunload does not fire
  // for a client navigation. The capture listener on document runs before the
  // React handlers on the root, so a cancel stops next/link too.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!leavingRef.current) e.preventDefault();
    };
    const guard = (e: MouseEvent) => {
      if (leavingRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      // another site, or a section of this page
      if (url.origin !== window.location.origin || url.pathname === "/profile") return;
      if (window.confirm("Leave this page? Your changes are not saved.")) {
        leavingRef.current = true;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty]);

  /* --------------------------------------------------------- actions */
  // The input of a field with an error. Most fields register their input
  // with the form; LinkedIn and the websites are custom controls, and the
  // wallets have no input, so their error line scrolls into view.
  const focusField = (field: keyof ProfileFormValues) => {
    const root = contentRef.current;
    const input =
      field === "linkedin_account"
        ? document.getElementById("pr-linkedin")
        : field === "additional_social_accounts"
          ? root?.querySelector<HTMLElement>('input[type="url"]')
          : null;
    if (input) {
      input.focus();
      return;
    }
    if (field === "wallet") {
      document.getElementById("pr-wallet-error")?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      return;
    }
    form.setFocus(field);
  };

  const handleSave = async () => {
    setSaveError(null);
    const result = await save();
    if (result.ok) {
      // a save that worked unmounts the bar, so a toast covers nothing
      sonnerToast.success("Profile saved");
      focusSectionTop();
      return;
    }
    setSaveError(result.message);
    const field = result.field;
    if (!field) return;
    // the field can be in the other form section: open it, then focus the
    // field after the heading-focus effect, as jumpToNext does
    const section = sectionOfField(field);
    if (section !== active) select(section);
    requestAnimationFrame(() => requestAnimationFrame(() => focusField(field)));
  };

  const handleDiscard = () => {
    setSaveError(null);
    form.reset();
    focusSectionTop();
    sonnerToast("Changes discarded");
  };

  const jumpToNext = () => {
    const next = completion.next?.key;
    const target = next ? STEP_SECTION[next] : undefined;
    if (!target) return;
    select(target.section);
    const field = target.field;
    if (field) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(field)?.focus()));
  };

  const handleConnectGithub = () => {
    window.location.href = "/api/auth/github-link";
  };
  const handleDisconnectGithub = async () => {
    try {
      const res = await fetch("/api/auth/github-link/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGithubConnected(false);
      // the new starting value too, so Discard cannot bring the link back
      form.resetField("github_account", { defaultValue: "" });
      sonnerToast.success("GitHub disconnected");
    } catch {
      sonnerToast.error("Could not disconnect GitHub");
    }
  };
  const handleConnectX = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/auth/x-link?returnTo=${encodeURIComponent(returnTo)}`;
  };
  const handleDisconnectX = async () => {
    try {
      const res = await fetch("/api/auth/x-link/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.resetField("x_account", { defaultValue: "" });
      sonnerToast.success("X disconnected");
    } catch {
      sonnerToast.error("Could not disconnect X");
    }
  };

  const handleSignOutConfirm = async () => {
    localStorage.removeItem("redirectAfterProfile");
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("formData_")) localStorage.removeItem(key);
    });
    // the user confirmed: no leave prompt after the session has ended
    leavingRef.current = true;
    try {
      await signOut({ redirect: false });
    } catch (err) {
      leavingRef.current = false;
      throw err;
    }
    window.location.href = "/";
  };

  // A dialog opened from a button returns the focus to that button.
  const openWith = (open: (value: boolean) => void) => () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open(true);
  };
  const restoreFocus = (e: Event) => {
    const opener = openerRef.current;
    if (!opener?.isConnected) return;
    e.preventDefault();
    opener.focus();
  };

  // The photo saves at once, as the Settings switches do: it has no draft
  // for Save or Discard. Resolves with an error text, or null.
  const handlePhotoChange = async (file: File | null): Promise<string | null> => {
    let res: Response;
    try {
      if (file) {
        const body = new FormData();
        body.set("file", file);
        res = await fetch("/api/profile/photo", { method: "POST", body });
      } else {
        res = await fetch("/api/profile/photo", { method: "DELETE" });
      }
    } catch {
      return "Could not reach the server. Try again.";
    }
    const data = (await res.json().catch(() => ({}))) as { image?: string; error?: string };
    if (!res.ok) return data.error || "Could not save your photo. Try again.";
    form.resetField("image", { defaultValue: data.image ?? "" });
    // the site header reads the photo from the session
    void updateSession();
    sonnerToast.success(file ? "Photo saved" : "Photo removed");
    return null;
  };

  const referralCatalog: ReferralTarget[] = React.useMemo(
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
  const referralLinks: ReferralLink[] = React.useMemo(() => {
    const byKey = new Map(summary.referralTargets.map((t) => [`${t.targetType}|${t.targetId ?? ""}`, t]));
    return summary.referralLinks.map((l) => {
      const t = byKey.get(`${l.targetType}|${l.targetId ?? ""}`);
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

  const createReferral = async (target: ReferralTarget) => {
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
      sonnerToast.success("Referral link made");
    } catch {
      sonnerToast.error("Could not make the referral link");
    }
  };

  /* ---------------------------------------------------------- render */
  const name = values.name ?? "";
  const email = values.email || session?.user?.email || "";
  const imageUrl = values.image || null;
  // read during render, so the form reports changes to the edited fields
  const dirtyKeys = Object.keys(form.formState.dirtyFields);
  // the section that holds the edits; Personal info when both have some
  const editedSection: SectionId =
    dirtyKeys.length > 0 && dirtyKeys.every((k) => ACCOUNT_FIELDS.has(k)) ? "accounts" : "personal";
  const identity = (compact: boolean) => (
    <Identity
      name={name}
      handle={values.username ?? ""}
      email={email}
      imageUrl={imageUrl}
      teamLabel={teamLabel}
      completion={{ pct: completion.pct, nextLabel: completion.next?.label ?? null }}
      onJumpToNext={jumpToNext}
      compact={compact}
    />
  );

  let content: React.ReactNode;
  if (FORM_SECTIONS.includes(active) && isLoading) {
    content = <PageSpinner />;
  } else if (FORM_SECTIONS.includes(active) && loadFailed) {
    content = (
      <Group label="Profile">
        <ErrorLine onRetry={reload}>Could not load your profile.</ErrorLine>
      </Group>
    );
  } else {
    switch (active) {
      case "personal":
        content = (
          <PersonalSection form={form} imageUrl={imageUrl} onPhotoChange={handlePhotoChange} />
        );
        break;
      case "accounts":
        content = (
          <AccountsSection
            form={form}
            githubConnected={githubConnected}
            onGithubConnect={handleConnectGithub}
            onGithubDisconnect={handleDisconnectGithub}
            onXConnect={handleConnectX}
            onXDisconnect={handleDisconnectX}
          />
        );
        break;
      case "settings":
        content = <SettingsSection userId={userId} email={email} onSignOut={openWith(setSignOutOpen)} />;
        break;
      case "referrals":
        content = (
          <ReferralsSection
            links={referralLinks}
            targets={referralCatalog}
            totalSignups={summary.referralCount}
            loading={summaryLoading}
            failed={summaryFailed}
            onRetry={loadSummary}
            onCreate={createReferral}
            onCopy={() => sonnerToast.success("Referral link copied")}
          />
        );
        break;
      case "projects":
        content = (
          <ProjectsSection projects={summary.projects} loading={summaryLoading} failed={summaryFailed} onRetry={loadSummary} />
        );
        break;
      case "achievements":
        content = (
          <AchievementsSection
            badges={summary.badges}
            academy={summary.academy}
            loading={summaryLoading}
            failed={summaryFailed}
            onRetry={loadSummary}
          />
        );
        break;
      case "console":
        content = <ConsoleHistorySection />;
        break;
      case "query":
        content = <QuerySection />;
        break;
      case "alerts":
        content = <AlertsSection email={email} />;
        break;
      case "insights":
        content = (
          <>
            <SectionHeader eyebrow="Team" title="Insights" id="section-title" />
            <div className="profile">
              <InsightsCard data={insightsData} loading={insightsLoading} error={insightsError} />
            </div>
          </>
        );
        break;
      case "notifications":
        content = (
          <>
            <SectionHeader eyebrow="Team" title="Send notifications" id="section-title" />
            <Group label="New notification" divide={false}>
              <div className="p-4 sm:p-5">
                <SendNotificationsForm totalBuilders={summary.totalBuilders} hideHeader />
              </div>
            </Group>
          </>
        );
        break;
    }
  }

  return (
    <ProfileFrame>
      <div className="lg:mx-auto lg:grid lg:max-w-[71rem] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <ProfileRail sections={sections} active={active} onSelect={select} identity={identity(false)} />
        <div ref={contentRef} className="min-w-0 max-w-[52rem]">
          <div className="mb-6 lg:hidden">{identity(true)}</div>
          <ProfileTabs sections={sections} active={active} onSelect={select} />
          <div className="[&_#section-title]:outline-none">{content}</div>
          {dirty && (
            <SaveBar
              saving={isSaving}
              error={saveError}
              onSave={handleSave}
              onDiscard={handleDiscard}
              onReview={active === editedSection ? undefined : () => select(editedSection)}
            />
          )}
        </div>
      </div>
      <SignOutComponent
        isOpen={signOutOpen}
        onOpenChange={setSignOutOpen}
        onConfirm={handleSignOutConfirm}
        onCloseAutoFocus={restoreFocus}
        note={dirty ? "You will lose your unsaved changes." : undefined}
      />
    </ProfileFrame>
  );
}
