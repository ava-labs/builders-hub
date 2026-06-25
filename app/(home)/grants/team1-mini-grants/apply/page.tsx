"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Team1Symbol, Team1Wordmark } from "@/components/grants/Team1Wordmark";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, getSession } from "next-auth/react";
import { useLoginModalTrigger, useLoginCompleteListener } from "@/hooks/useLoginModal";
import { useForm, type Resolver, type FieldErrors } from "react-hook-form";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Check,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  miniGrantFormSchema,
  MAX_GRANT_BUDGET_USD,
  type MiniGrantFormData,
} from "@/types/miniGrantForm";
import { MINI_GRANT_HACKATHON_ID, MINI_GRANT_KEY } from "@/lib/grants/programs";
import {
  clearStoredReferralAttribution,
  getStoredReferralAttribution,
} from "@/lib/referrals/client";

const CONSENT_TEXT =
  "I consent to the sharing of my data with Team1.";
//  "Mini Grants is a Team1 program; I agree to share my application data with Team1.";

const STEPS = ["Consent", "Project", "Your details", "Members", "Grant"] as const;

// Project categories — mirrors the /build-games/submit project overview options.
const PROJECT_CATEGORIES = [
  "DeFi",
  "Gaming",
  "NFT / Digital Assets",
  "Infrastructure",
  "Social",
  "DAO / Governance",
  "Identity",
  "Other",
] as const;

// A displayable project link (website, social, prototype/demo).
interface ProjectLink {
  label: string;
  url: string;
}

// Shape returned by GET /api/projects/member (raw Prisma project rows).
interface UserProject {
  id: string;
  project_name: string | null;
  short_description: string | null;
  // Null only for unsubmitted drafts; deletion is offered only for those.
  hackaton_id: string | null;
  url: string | null;
  links: ProjectLink[];
  socials: Record<string, string>;
  website: Record<string, string>;
  category: string | null;
  other_category: string | null;
  is_preexisting_idea: boolean;
}

// Normalize a Prisma Json column ({ label: url }) into a plain string map,
// dropping empty / non-string values.
function asLinkMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

// Collect a project's public links for display on the project card. Different
// submission flows store these in heterogeneous shapes: `website`/`socials` as
// a { label: url } map (hackathon form) or { url } (this wizard); `demo_link`
// as a comma-separated string. There is no dedicated pitch-deck field, so any
// pitch-deck/prototype link surfaces via these fields if the user added it.
function collectProjectLinks(row: Record<string, unknown>): ProjectLink[] {
  const links: ProjectLink[] = [];
  const pushUrl = (label: string, value: unknown) => {
    if (typeof value !== "string") return;
    const url = value.trim();
    if (/^https?:\/\//i.test(url)) links.push({ label, url });
  };
  const pushMap = (value: unknown, fallbackLabel: string) => {
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      pushUrl(key === "url" || /^link_\d+$/.test(key) ? fallbackLabel : key, v);
    }
  };
  pushMap(row.website, "Website");
  pushMap(row.socials, "Social");
  for (const d of String(row.demo_link ?? "").split(",")) pushUrl("Prototype", d);
  pushUrl("Demo video", row.demo_video_link);
  return links;
}

// Best-effort read of a project's URL: stored as website { url } by this wizard,
// falling back to demo_link for projects created elsewhere.
function readProjectUrl(row: { website?: unknown; demo_link?: string | null }): string {
  const site = row.website as { url?: string } | null | undefined;
  return (site?.url || row.demo_link || "").trim();
}

// Shape returned by GET /api/project/[project_id]/members.
interface ProjectMember {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: string;
}

// Validate with safeParse so a ZodError is never thrown. The installed
// @hookform/resolvers (4.1.3) doesn't recognise Zod 4.1's issue shape and
// re-throws the error as an unhandled rejection on the onChange/trigger path.
// Mapping issues to react-hook-form field errors lets <FormMessage> render them.
const miniGrantResolver: Resolver<MiniGrantFormData> = async (values) => {
  const result = miniGrantFormSchema.safeParse(values);
  if (result.success) {
    return { values: result.data, errors: {} };
  }
  const errors: FieldErrors<MiniGrantFormData> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      (errors as Record<string, { type: string; message: string }>)[key] = {
        type: String(issue.code),
        message: issue.message,
      };
    }
  }
  return { values: {}, errors };
};

export default function Team1MiniGrantsApplyPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openLoginModal } = useLoginModalTrigger();
  const hasTriggeredModalRef = useRef(false);
  const handledProjectParamRef = useRef(false);
  const [authGateState, setAuthGateState] = useState<"checking" | "ready" | "prompt">("checking");

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: consent
  const [consentTeam1, setConsentTeam1] = useState(false);

  // Step 2: project selection / creation
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectUrl, setNewProjectUrl] = useState("");
  const [newProjectX, setNewProjectX] = useState("");
  const [newProjectGithub, setNewProjectGithub] = useState("");
  const [newProjectLinks, setNewProjectLinks] = useState<ProjectLink[]>([]);
  const [newProjectCategory, setNewProjectCategory] = useState("");
  const [newProjectOtherCategory, setNewProjectOtherCategory] = useState("");
  const [newProjectExisting, setNewProjectExisting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Existing applications by this user for this program.
  const [applications, setApplications] = useState<
    { id: string; projectId: string; projectName: string; status: string }[]
  >([]);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);

  // Step 4: members
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingMember, setInvitingMember] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Step 5: final submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<"success" | null>(null);

  useLoginCompleteListener(async () => {
    await update();
    hasTriggeredModalRef.current = false;
    setAuthGateState("ready");
  });

  const form = useForm<MiniGrantFormData>({
    resolver: miniGrantResolver,
    defaultValues: {
      project_url: "",
      requested_amount_usd: undefined as unknown as number,
      summary: "",
      milestones: "",
      why_grant: "",
      additional_url: "",
      x_profile: "",
      telegram: "",
    },
    mode: "onChange",
  });

  // Login gate (mirrors the research proposal form).
  useEffect(() => {
    if (status === "loading") {
      setAuthGateState("checking");
      return;
    }

    if (status === "authenticated" && session?.user) {
      setAuthGateState("ready");
      return;
    }

    const checkAndTriggerModal = async () => {
      const freshSession = await getSession();
      if (freshSession?.user) {
        setAuthGateState("ready");
        return;
      }

      setAuthGateState("prompt");

      if (!hasTriggeredModalRef.current) {
        hasTriggeredModalRef.current = true;
        openLoginModal(window.location.href);
      }
    };

    setAuthGateState("checking");
    checkAndTriggerModal();
  }, [status, session, openLoginModal]);

  // Load the user's existing projects once authenticated.
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await fetch("/api/projects/member");
      if (!res.ok) throw new Error("Failed to load your projects");
      const data = (await res.json()) as Array<Record<string, unknown>>;
      const mapped: UserProject[] = Array.isArray(data)
        ? data.map((p) => {
            const cats = Array.isArray(p.categories) ? (p.categories as string[]) : [];
            return {
              id: String(p.id),
              project_name: (p.project_name as string | null) ?? null,
              short_description: (p.short_description as string | null) ?? null,
              hackaton_id: (p.hackaton_id as string | null) ?? null,
              url: readProjectUrl(p) || null,
              links: collectProjectLinks(p),
              socials: asLinkMap(p.socials),
              website: asLinkMap(p.website),
              category: cats.length ? cats[0] : null,
              other_category: (p.other_category as string | null) ?? null,
              is_preexisting_idea: Boolean(p.is_preexisting_idea),
            };
          })
        : [];
      setProjects(mapped);
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : "Failed to load your projects");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/grants/team1-mini-grants/applications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        applications?: { id: string; projectId: string; projectName: string; status: string }[];
      };
      setApplications(data.applications ?? []);
    } catch {
      /* non-fatal: the apply flow still works without the prior-applications list */
    } finally {
      setApplicationsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (authGateState === "ready") {
      loadProjects();
      loadApplications();
    }
  }, [authGateState, loadProjects, loadApplications]);

  useEffect(() => {
    if (handledProjectParamRef.current || projectsLoading || !applicationsLoaded) return;
    const projectId = searchParams.get("project");
    if (!projectId || projects.length === 0) return;

    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      handledProjectParamRef.current = true;
      return;
    }

    const isApplied = applications.some((a) => a.projectId === project.id);
    if (!isApplied && (!project.hackaton_id || project.hackaton_id === MINI_GRANT_HACKATHON_ID)) {
      handledProjectParamRef.current = true;
      setConsentTeam1(true);
      setSelectedProjectId(project.id);
      setActiveStep(1);
      startEditProject(project);
    }
  }, [applications, applicationsLoaded, projects, projectsLoading, searchParams]);

  // Prefill the contact fields from the signed-in user's profile, without
  // clobbering anything they've already typed. Best-effort: the form still
  // works if the profile fetch fails.
  useEffect(() => {
    const userId = session?.user?.id;
    if (authGateState !== "ready" || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/profile/extended/${userId}`);
        if (!res.ok || cancelled) return;
        const profile = (await res.json()) as {
          x_account?: string | null;
          telegram_account?: string | null;
        };
        if (cancelled) return;
        if (profile.x_account && !form.getValues("x_profile")) {
          form.setValue("x_profile", profile.x_account, { shouldValidate: true });
        }
        if (profile.telegram_account && !form.getValues("telegram")) {
          form.setValue("telegram", profile.telegram_account);
        }
      } catch {
        /* prefill is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authGateState, session?.user?.id, form]);

  const appliedProjectIds = new Set(applications.map((a) => a.projectId));

  // Load members whenever the chosen project changes / we enter step 4.
  const loadMembers = useCallback(async (projectId: string) => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetch(`/api/project/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to load project members");
      const data = (await res.json()) as ProjectMember[];
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : "Failed to load project members");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeStep === 3 && selectedProjectId) {
      loadMembers(selectedProjectId);
    }
  }, [activeStep, selectedProjectId, loadMembers]);

  // Copy the selected project's URL into the grant form (editable if empty).
  useEffect(() => {
    if (!selectedProjectId) return;
    const proj = projects.find((p) => p.id === selectedProjectId);
    // Pre-fill without forcing validation — validating the (still-empty) step-5
    // fields here surfaces a ZodError. Field-level <FormMessage> handles errors.
    if (proj?.url) form.setValue("project_url", proj.url);
  }, [selectedProjectId, projects, form]);

  function clearProjectForm() {
    setEditingProjectId(null);
    setCreateProjectError(null);
    setNewProjectName("");
    setNewProjectDescription("");
    setNewProjectUrl("");
    setNewProjectX("");
    setNewProjectGithub("");
    setNewProjectLinks([]);
    setNewProjectCategory("");
    setNewProjectOtherCategory("");
    setNewProjectExisting(false);
  }

  // Social keys we surface as dedicated inputs; everything else round-trips
  // through the generic links list so nothing is lost on edit.
  const X_KEYS = ["X", "x", "twitter", "Twitter"];
  const GITHUB_KEYS = ["GitHub", "github", "Github"];

  function startEditProject(p: UserProject) {
    setEditingProjectId(p.id);
    setCreateProjectError(null);
    setNewProjectName(p.project_name ?? "");
    setNewProjectDescription(p.short_description ?? "");
    setNewProjectUrl(p.url ?? "");
    setNewProjectX(X_KEYS.map((k) => p.socials[k]).find(Boolean) ?? "");
    setNewProjectGithub(GITHUB_KEYS.map((k) => p.socials[k]).find(Boolean) ?? "");

    // Generic links = website entries (minus the main url) + any non-X/GitHub socials.
    const extras: ProjectLink[] = [];
    for (const [k, v] of Object.entries(p.website)) {
      if (k !== "url" && v !== p.url) extras.push({ label: k, url: v });
    }
    for (const [k, v] of Object.entries(p.socials)) {
      if (!X_KEYS.includes(k) && !GITHUB_KEYS.includes(k)) extras.push({ label: k, url: v });
    }
    setNewProjectLinks(extras);
    setNewProjectExisting(p.is_preexisting_idea);
    setShowCreateForm(true);
  }

  async function handleSaveProject() {
    if (!newProjectName.trim() || !newProjectDescription.trim()) {
      setCreateProjectError("Project name and a one-sentence description are required.");
      return;
    }
    setCreatingProject(true);
    setCreateProjectError(null);
    const payload = {
      project_name: newProjectName.trim(),
      short_description: newProjectDescription.trim(),
      categories: newProjectCategory ? [newProjectCategory] : [],
      other_category:
        newProjectCategory === "Other" ? newProjectOtherCategory.trim() || null : null,
      is_preexisting_idea: newProjectExisting,
    };
    const url = newProjectUrl.trim();

    // Socials map (X / GitHub), and the generic links map under `website`
    // (which also carries the main project url under the `url` key).
    const socials: Record<string, string> = {};
    if (newProjectX.trim()) socials.X = newProjectX.trim();
    if (newProjectGithub.trim()) socials.GitHub = newProjectGithub.trim();

    const website: Record<string, string> = {};
    if (url) website.url = url;
    for (const link of newProjectLinks) {
      const label = link.label.trim();
      const linkUrl = link.url.trim();
      if (label && /^https?:\/\//i.test(linkUrl)) website[label] = linkUrl;
    }

    try {
      if (editingProjectId) {
        const res = await fetch(`/api/projects/${editingProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, website, socials }),
        });
        if (!res.ok) throw new Error("Failed to save changes. Please try again.");
        const id = editingProjectId;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  project_name: payload.project_name,
                  short_description: payload.short_description,
                  url: url || null,
                  socials,
                  website,
                  links: collectProjectLinks({ website, socials }),
                  category: newProjectCategory || null,
                  other_category: payload.other_category,
                  is_preexisting_idea: newProjectExisting,
                }
              : p,
          ),
        );
        if (selectedProjectId === id && url) form.setValue("project_url", url);
        clearProjectForm();
        setShowCreateForm(false);
      } else {
        const res = await fetch("/api/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            origin: MINI_GRANT_KEY,
            website,
            socials,
          }),
        });
        const result = (await res.json().catch(() => null)) as
          | { project?: { id?: string }; error?: unknown }
          | null;
        if (!res.ok || !result?.project?.id) {
          throw new Error("Failed to create the project. Please try again.");
        }
        const created: UserProject = {
          id: result.project.id,
          project_name: payload.project_name,
          short_description: payload.short_description,
          hackaton_id: null,
          url: url || null,
          socials,
          website,
          links: collectProjectLinks({ website, socials }),
          category: newProjectCategory || null,
          other_category: payload.other_category,
          is_preexisting_idea: newProjectExisting,
        };
        setProjects((prev) => [created, ...prev]);
        setSelectedProjectId(created.id);
        clearProjectForm();
        setShowCreateForm(false);
      }
    } catch (err) {
      setCreateProjectError(
        err instanceof Error ? err.message : "Failed to save the project. Please try again.",
      );
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleInviteMember() {
    const email = inviteEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    if (!selectedProjectId) return;
    setInvitingMember(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch("/api/project/invite-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: [email],
          hackathon_id: MINI_GRANT_HACKATHON_ID,
          project_id: selectedProjectId,
          user_id: session?.user?.id,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to send the invitation. Please try again.");
      }
      setInviteSuccess(`Invitation sent to ${email}.`);
      setInviteEmail("");
      await loadMembers(selectedProjectId);
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to send the invitation. Please try again.",
      );
    } finally {
      setInvitingMember(false);
    }
  }

  async function onSubmit(values: MiniGrantFormData) {
    if (!selectedProjectId) {
      setSubmitError("Please select a project before submitting.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/grants/team1-mini-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          consentTeam1: true,
          referral_attribution: getStoredReferralAttribution(),
          ...values,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { success?: boolean; message?: string; referralAttributed?: boolean }
        | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to submit your application.");
      }
      if (result.referralAttributed) {
        clearStoredReferralAttribution();
      }
      setSubmissionStatus("success");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "We couldn't submit your application. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canAdvanceFromStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return consentTeam1;
      case 1:
        return Boolean(selectedProjectId) && !projectsLoading;
      default:
        return true;
    }
  };

  function goNext() {
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setActiveStep((s) => Math.max(s - 1, 0));
  }

  // ---- Render guards (mirror the research proposal form) ----

  if (status === "loading" || authGateState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated (or the login dialog was dismissed): stay on the page and
  // show the program info. The user can read everything; submitting requires
  // signing in (the wizard steps need a session to load projects/members).
  if (authGateState === "prompt") {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-2xl px-4 py-16 space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Team1Symbol className="h-9 w-9" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Team1 Mini Grants</h1>
            <p className="text-muted-foreground leading-relaxed">
              Fast, focused funding for builders on Avalanche. You can read everything here without
              an account &mdash; you only need to{" "}
              <span className="font-medium text-foreground">sign in to submit an application</span>,
              so we can tie it to your account and follow up.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What applying involves once you sign in:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Agree to share your application with Team1</li>
              <li>Pick an existing project or create a new one</li>
              <li>Confirm your details and add teammates</li>
              <li>Fill out the grant form and submit</li>
            </ol>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button className="min-w-48" onClick={() => openLoginModal(window.location.href)}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in to apply
            </Button>
            <Link
              href="/grants/team1-mini-grants"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              &larr; Back to program details
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (submissionStatus === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
          <Team1Wordmark className="mx-auto h-8" />
          <div className="mx-auto my-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Application submitted</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Thanks for applying to Team1 Mini Grants. We&apos;ll review it and follow up at the email
            on your account. You can track its status on the Mini Grants page.
          </p>
          <Button
            className="mt-7 min-w-48"
            onClick={() => router.push("/grants/team1-mini-grants")}
          >
            Back to Mini Grants
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <Team1Symbol className="h-9 w-9" />
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Team1 Mini Grants
          </span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Apply for a Mini Grant</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            A short, guided application. Complete each step to submit your project.
          </p>
        </div>

        {/* Stepper */}
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2">
            {STEPS.map((label, index) => {
              const isComplete = index < activeStep;
              const isCurrent = index === activeStep;
              return (
                <li key={label} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                      isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : isComplete
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span className="mx-1 hidden h-px w-6 bg-border sm:inline-block" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          {/* Step 1: Consent */}
          {activeStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Consent</h2>
              <p className="text-muted-foreground">
                Mini Grants is operated by Team1. Please confirm that you agree to share your
                application data with Team1 before continuing.
              </p>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
                <Checkbox
                  id="consentTeam1"
                  checked={consentTeam1}
                  onCheckedChange={(checked) => setConsentTeam1(checked === true)}
                />
                <Label htmlFor="consentTeam1" className="cursor-pointer text-sm font-normal">
                  {CONSENT_TEXT}
                </Label>
              </div>
            </div>
          )}

          {/* Step 2: Project */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Choose a project</h2>
              <p className="text-muted-foreground">
                Select one of your existing projects, or create a new one for this application.
              </p>

              {applications.length > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>
                    You&apos;ve already applied with{" "}
                    {applications.length === 1 ? "1 project" : `${applications.length} projects`}
                  </AlertTitle>
                  <AlertDescription>
                    You can apply again, but with a different project. Projects you&apos;ve already
                    submitted are marked below.
                  </AlertDescription>
                </Alert>
              )}

              {projectsError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not load projects</AlertTitle>
                  <AlertDescription>{projectsError}</AlertDescription>
                </Alert>
              )}

              {projectsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your projects...
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      You don&apos;t have any projects yet. Create one to continue.
                    </p>
                  )}
                  {projects.toSorted((a, b) => {
                    const aApplied = appliedProjectIds.has(a.id);
                    const bApplied = appliedProjectIds.has(b.id);
                    if (aApplied === bApplied) return 0;
                    return aApplied ? 1 : -1;
                  }).map((project) => {
                    const isSelected = selectedProjectId === project.id;
                    const appliedApp = applications.find((a) => a.projectId === project.id);
                    const isApplied = !!appliedApp;
                    // Editing is only for unsubmitted drafts (mirrors the server
                    // guard): not yet applied and attached to no hackathon.
                    const isDraft =
                      !isApplied &&
                      (!project.hackaton_id || project.hackaton_id === MINI_GRANT_HACKATHON_ID);
                    return (
                      <div
                        key={project.id}
                        className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors ${
                          isApplied
                            ? "border-border opacity-70"
                            : isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                        }`}
                      >
                       <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          disabled={isApplied}
                          onClick={() => {
                            if (isApplied) return;
                            setSelectedProjectId(project.id);
                            setShowCreateForm(false);
                          }}
                          className={`flex flex-1 items-start gap-3 text-left ${
                            isApplied ? "cursor-not-allowed" : ""
                          }`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              {project.project_name || "Untitled Project"}
                            </div>
                            {project.short_description && (
                              <div className="mt-1 text-sm text-muted-foreground">
                                {project.short_description}
                              </div>
                            )}
                          </div>
                          {isApplied ? (
                            <span className="mt-1 shrink-0 text-xs font-medium text-muted-foreground">
                              Applied
                            </span>
                          ) : (
                            isSelected && <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
                          )}
                        </button>
                        {isDraft && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditProject(project)}
                              aria-label="Edit project"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                       </div>
                        {project.links.length > 0 && (
                          <div className="flex flex-wrap gap-2 pl-1">
                            {project.links.map((link, i) => (
                              <a
                                key={`${link.url}-${i}`}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {link.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!showCreateForm ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    clearProjectForm();
                    setShowCreateForm(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create new project
                </Button>
              ) : (
                <Card className="space-y-4 border-border p-4">
                  <h3 className="font-semibold text-foreground">
                    {editingProjectId ? "Edit project" : "New project"}
                  </h3>
                  {createProjectError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{createProjectError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="new_project_name">Project name *</Label>
                    <Input
                      id="new_project_name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="My project"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_project_description">One-sentence description *</Label>
                    <Textarea
                      id="new_project_description"
                      rows={3}
                      maxLength={280}
                      value={newProjectDescription}
                      onChange={(e) => setNewProjectDescription(e.target.value)}
                      placeholder="Summarize your project in one sentence (max 280 characters)."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_project_url">Project URL</Label>
                    <Input
                      id="new_project_url"
                      type="url"
                      value={newProjectUrl}
                      onChange={(e) => setNewProjectUrl(e.target.value)}
                      placeholder="https://your-project.xyz"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new_project_x">X (Twitter)</Label>
                      <Input
                        id="new_project_x"
                        type="url"
                        value={newProjectX}
                        onChange={(e) => setNewProjectX(e.target.value)}
                        placeholder="https://x.com/yourproject"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new_project_github">GitHub</Label>
                      <Input
                        id="new_project_github"
                        type="url"
                        value={newProjectGithub}
                        onChange={(e) => setNewProjectGithub(e.target.value)}
                        placeholder="https://github.com/yourproject"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Other links</Label>
                    <p className="text-sm text-muted-foreground">
                      Add a pitch deck, demo, docs, or any other link.
                    </p>
                    {newProjectLinks.map((link, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Input
                          aria-label={`Link ${i + 1} label`}
                          value={link.label}
                          onChange={(e) =>
                            setNewProjectLinks((prev) =>
                              prev.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                            )
                          }
                          placeholder="Pitch deck"
                          className="sm:max-w-[180px]"
                        />
                        <Input
                          aria-label={`Link ${i + 1} URL`}
                          type="url"
                          value={link.url}
                          onChange={(e) =>
                            setNewProjectLinks((prev) =>
                              prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)),
                            )
                          }
                          placeholder="https://..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setNewProjectLinks((prev) => prev.filter((_, j) => j !== i))
                          }
                          aria-label="Remove link"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewProjectLinks((prev) => [...prev, { label: "", url: "" }])}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add link
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Project category</Label>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewProjectCategory(cat)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                            newProjectCategory === cat
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  {newProjectCategory === "Other" && (
                    <div className="space-y-2">
                      <Label htmlFor="new_project_other_category">Please specify your category</Label>
                      <Input
                        id="new_project_other_category"
                        value={newProjectOtherCategory}
                        onChange={(e) => setNewProjectOtherCategory(e.target.value)}
                        placeholder="Describe your project category..."
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Is this an existing project?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "No — new idea", value: false },
                        { label: "Yes — existing project", value: true },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setNewProjectExisting(opt.value)}
                          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                            newProjectExisting === opt.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleSaveProject} disabled={creatingProject}>
                      {creatingProject ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingProjectId ? (
                        "Save changes"
                      ) : (
                        "Create project"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        clearProjectForm();
                        setShowCreateForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Personal data */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Your details</h2>
              <p className="text-muted-foreground">
                These come from your signed-in account and are used for all correspondence.
              </p>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input readOnly value={session?.user?.name ?? ""} className="bg-muted/40" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  readOnly
                  type="email"
                  value={session?.user?.email ?? ""}
                  className="bg-muted/40"
                />
                <p className="text-sm text-muted-foreground">
                  To update these details,{" "}
                  <Link href="/profile" className="font-medium text-foreground underline underline-offset-4">
                    edit your profile
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Members */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Team members</h2>
              <p className="text-muted-foreground">
                These people are part of the selected project. You can invite more by email.
              </p>

              {membersError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not load members</AlertTitle>
                  <AlertDescription>{membersError}</AlertDescription>
                </Alert>
              )}

              {membersLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  No members found for this project yet.
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="font-medium text-foreground">
                          {member.name || member.email || "Unknown member"}
                        </div>
                        {member.email && (
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                          {member.role}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {member.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Card className="space-y-3 border-border p-4">
                <Label htmlFor="invite_email" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite a member
                </Label>
                {inviteError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{inviteError}</AlertDescription>
                  </Alert>
                )}
                {inviteSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400">{inviteSuccess}</p>
                )}
                <div className="flex gap-2">
                  <Input
                    id="invite_email"
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <Button type="button" onClick={handleInviteMember} disabled={invitingMember}>
                    {invitingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Step 5: Grant form */}
          {activeStep === 4 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Grant details</h2>

                {submitError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Submission failed</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="project_url"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label>Project URL *</Label>
                      <FormControl>
                        <Input type="url" placeholder="https://..." {...field} />
                      </FormControl>
                      <FormDescription>Copied from your project — edit if needed.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requested_amount_usd"
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem className="space-y-2">
                      <Label>Requested Amount (USD) *</Label>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_GRANT_BUDGET_USD}
                          step={1}
                          placeholder="e.g. 5000"
                          value={value ?? ""}
                          onChange={(e) => {
                            const next = e.target.valueAsNumber;
                            if (Number.isNaN(next)) {
                              onChange(undefined);
                              return;
                            }
                            // Hard-cap the field so more than the max can't be entered.
                            onChange(Math.min(next, MAX_GRANT_BUDGET_USD));
                          }}
                          {...rest}
                        />
                      </FormControl>
                      <FormDescription>
                        Whole dollars. Maximum ${MAX_GRANT_BUDGET_USD.toLocaleString()} USD.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label>Summary *</Label>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Briefly describe your project and what the grant will fund."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="milestones"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label>Milestones *</Label>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="List the milestones you plan to deliver with this grant."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="why_grant"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label>Why You Deserve a Grant *</Label>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Tell us why you'd be a great fit for a mini grant. We'd love to hear about your impact and how the funding would help."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additional_url"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <Label>Additional Link</Label>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://... (optional)"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional. A deck, demo, or any supporting material.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 border-t border-border pt-6">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">Contact information</h3>
                    <p className="text-sm text-muted-foreground">
                      So we can reach you about your application. Prefilled from your{" "}
                      <Link href="/profile" className="font-medium text-foreground underline underline-offset-4">
                        profile
                      </Link>{" "}
                      when available.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="x_profile"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <Label>X Profile *</Label>
                        <FormControl>
                          <Input
                            placeholder="@yourhandle or https://x.com/yourhandle"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <Label>Telegram</Label>
                        <FormControl>
                          <Input
                            placeholder="@yourhandle (optional)"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>Optional.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={goBack}>
                    Back
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="min-w-40">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>

        {/* Wizard navigation (hidden on the final step, which has its own submit row) */}
        {activeStep < STEPS.length - 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                activeStep === 0 ? router.push("/grants/team1-mini-grants") : goBack()
              }
            >
              Back
            </Button>
            <Button type="button" onClick={goNext} disabled={!canAdvanceFromStep(activeStep)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
