"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import axios from "axios";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  ChevronDown,
  Lock,
  X,
} from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { MultiLinkInput } from "@/components/hackathons/project-submission/components/MultiLinkInput";
import MembersComponent from "@/components/hackathons/project-submission/components/Members";
import InvalidInvitationComponent from "@/components/hackathons/project-submission/components/InvalidInvitationDialog";
import { Toaster } from "@/components/ui/toaster";
import type { Track } from "@/types/hackathons";
import { cn } from "@/utils/cn";

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

const STAGE_NAMES: Record<number, string> = {
  1: "Stage 1: Idea",
  2: "Stage 2: MVP",
  3: "Stage 3: GTM & Vision",
  4: "Stage 4: Finals",
};

const STAGE_SHORT_NAMES: Record<number, string> = {
  1: "Idea",
  2: "MVP",
  3: "GTM & Vision",
  4: "Finals",
};

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "Submit your project idea, team information, problem statement, and proposed solution.",
  2: "Functional prototype, GitHub repository with code, technical implementaiton details, and product walkthrough video (max 5 minutes) demonstrating key features.",
  3: "Submit your go-to-market plan, growth strategy, target user personas, competitive analysis, and long-term product vision.",
  4: "Provide your pitch deck, demo links, and complete project documentation for the final live presentation.",
};

// ── Zod Schema ────────────────────────────────────────────────────────────────
//
// Fields prefixed with bg_ are Build Games-specific and are stored in the
// FormData table under the { build_games: { ... } } JSON key.
// All other fields map to the Project table.
//
const FormSchema = z.object({
  // ── Project table fields ──────────────────────────────────────────────────
  project_name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(60, "Max 60 characters allowed")
    .optional()
    .or(z.literal("")),
  short_description: z
    .string()
    .max(280, "Max 280 characters allowed")
    .optional()
    .or(z.literal("")),
  full_description: z.string().optional().or(z.literal("")),
  tech_stack: z.string().optional().or(z.literal("")),
  github_repository: z.array(z.string()).optional(),
  demo_link: z.array(z.string()).optional(),
  demo_video_link: z.array(z.string()).optional(),
  tracks: z.array(z.string()).optional(),
  is_preexisting_idea: z.boolean().optional(),
  project_category: z.string().optional().or(z.literal("")),
  other_category: z.string().optional().or(z.literal("")),

  // ── Stage 1 — Gaming (→ FormData.build_games) ────────────────────────────
  bg_game_type: z.string().optional().or(z.literal("")),
  bg_game_genre: z.string().optional().or(z.literal("")),
  bg_game_genre_other: z.string().optional().or(z.literal("")),
  bg_game_loop: z.string().optional().or(z.literal("")),
  bg_web3_gaming_integration: z.string().optional().or(z.literal("")),
  bg_player_motivation: z.string().optional().or(z.literal("")),
  bg_game_economy: z.string().optional().or(z.literal("")),
  bg_target_player: z.string().optional().or(z.literal("")),

  // ── Stage 1 — Existing project follow-ups (→ FormData.build_games) ────────
  bg_existing_project_plan: z.string().optional().or(z.literal("")),
  bg_existing_achievements: z.string().optional().or(z.literal("")),

  // ── Stage 1 — Problem Identification ─────────────────────────────────────
  bg_problem_statement: z.string().optional().or(z.literal("")),
  bg_user_persona: z.string().optional().or(z.literal("")),
  bg_current_solutions: z.string().optional().or(z.literal("")),
  bg_proposed_solution: z.string().optional().or(z.literal("")),
  bg_onchain_trigger: z.string().optional().or(z.literal("")),

  // ── Stage 1 — Proposed Solution ──────────────────────────────────────────
  bg_architecture_overview: z.string().optional().or(z.literal("")),
  bg_user_journey: z.string().optional().or(z.literal("")),
  bg_moscow_framework: z.string().optional().or(z.literal("")),

  // ── Stage 2 — Gaming MVP ──────────────────────────────────────────────────
  bg_game_playable_state: z.string().optional().or(z.literal("")),
  bg_game_smart_contracts: z.string().optional().or(z.literal("")),
  bg_game_onboarding: z.string().optional().or(z.literal("")),
  bg_game_playtesting: z.string().optional().or(z.literal("")),

  // ── Stage 3 — Gaming GTM ──────────────────────────────────────────────────
  bg_game_acquisition: z.string().optional().or(z.literal("")),
  bg_game_community: z.string().optional().or(z.literal("")),
  bg_game_monetization: z.string().optional().or(z.literal("")),
  bg_game_competitors: z.string().optional().or(z.literal("")),

  // ── Stage 3 — Milestones (all categories) ────────────────────────────────
  bg_milestones: z
    .array(z.object({ period: z.string(), description: z.string() }))
    .optional(),

  // ── Stage 4 ───────────────────────────────────────────────────────────────
  bg_summary: z.string().optional().or(z.literal("")),
  bg_support_needed: z.string().optional().or(z.literal("")),

  // ── Stage 4 — Gaming Finals ───────────────────────────────────────────────
  bg_game_metrics: z.string().optional().or(z.literal("")),
  bg_game_vision: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof FormSchema>;

interface BuildGamesSubmitFormProps {
  stage: number;
}

export default function BuildGamesSubmitForm({
  stage,
}: BuildGamesSubmitFormProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openLoginModal } = useLoginModalTrigger();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false); // synchronous lock — blocks concurrent calls from any source
  const [success, setSuccess] = useState(false);
  const [openJoinTeamDialog, setOpenJoinTeamDialog] = useState(false);
  const [openCurrentProject, setOpenCurrentProject] = useState(false);
  const [joinTeamName, setJoinTeamName] = useState("");
  const [openInvalidInvitation, setOpenInvalidInvitation] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<
    { label: string; value: string }[]
  >([]);
  const [hackathonTracks, setHackathonTracks] = useState<Track[]>([]);
  const [openStages, setOpenStages] = useState<Set<number>>(
    () => new Set([stage])
  );

  const form = useForm<FormData>({
    resolver: standardSchemaResolver(FormSchema),
    defaultValues: {
      project_name: "",
      short_description: "",
      full_description: "",
      tech_stack: "",
      github_repository: [],
      demo_link: [],
      demo_video_link: [],
      tracks: [],
      is_preexisting_idea: false,
      project_category: "",
      other_category: "",
      bg_game_type: "",
      bg_game_genre: "",
      bg_game_genre_other: "",
      bg_game_loop: "",
      bg_web3_gaming_integration: "",
      bg_player_motivation: "",
      bg_game_economy: "",
      bg_target_player: "",
      bg_existing_project_plan: "",
      bg_existing_achievements: "",
      bg_problem_statement: "",
      bg_user_persona: "",
      bg_current_solutions: "",
      bg_proposed_solution: "",
      bg_onchain_trigger: "",
      bg_architecture_overview: "",
      bg_user_journey: "",
      bg_moscow_framework: "",
      bg_game_playable_state: "",
      bg_game_smart_contracts: "",
      bg_game_onboarding: "",
      bg_game_playtesting: "",
      bg_game_acquisition: "",
      bg_game_community: "",
      bg_game_monetization: "",
      bg_game_competitors: "",
      bg_milestones: [{ period: "", description: "" }],
      bg_summary: "",
      bg_support_needed: "",
      bg_game_metrics: "",
      bg_game_vision: "",
    },
  });

  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({
    control: form.control,
    name: "bg_milestones",
  });

  const handleRemoveMilestone = useCallback((index: number) => {
    removeMilestone(index);
  }, [removeMilestone]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") {
      const invitationId = searchParams.get("invitation");
      if (invitationId) {
        // Prompt login so we can validate the invitation after auth
        openLoginModal(window.location.href);
      } else {
        router.push("/build-games");
      }
    }
  }, [status, router, searchParams, openLoginModal]);

  // Check for ?invitation= param once authenticated and trigger the join dialog
  useEffect(() => {
    const invitationId = searchParams.get("invitation");
    if (!invitationId || !session?.user?.id) return;
    // OTP new users have a pending_ ID and no DB record yet — skip until profile is complete
    if (session.user.id.startsWith("pending_")) return;

    axios
      .get("/api/project/check-invitation", {
        params: { invitation: invitationId, user_id: session.user.id },
      })
      .then((res) => {
        if (!res.data?.invitation?.exists) {
          setOpenInvalidInvitation(true);
          return;
        }
        const invitation = res.data.invitation;
        const project = res.data.project;
        setJoinTeamName(project?.project_name || "");
        if (project?.id) setProjectId(project.id);
        if (invitation.hasConfirmedProject) {
          // User already has a confirmed project — warning dialog handles cleanup
          setOpenCurrentProject(true);
        } else if (invitation.isConfirming) {
          // Fresh invitation, no existing project to clean up
          setOpenJoinTeamDialog(true);
        } else {
          // Invitation exists but is stale/already used
          setOpenInvalidInvitation(true);
        }
      })
      .catch(() => {
        setOpenInvalidInvitation(true);
      });
  }, [session?.user?.id, searchParams]);

  useEffect(() => {
    axios
      .get(`/api/hackathons/${HACKATHON_ID}`)
      .then((res) => {
        const tracks: Track[] = res.data?.content?.tracks ?? [];
        setHackathonTracks(tracks);
        setAvailableTracks(
          tracks.map((t) => ({ value: t.name, label: t.name }))
        );
      })
      .catch(() => {});
  }, []);

  // Load existing Project + FormData to pre-populate the form
  useEffect(() => {
    if (!session?.user?.id) return;

    axios
      .get("/api/project", {
        params: { hackathon_id: HACKATHON_ID, user_id: session.user.id },
      })
      .then(async (res) => {
        if (!res.data.project) return;
        const p = res.data.project;
        const pid = p.id ?? "";
        setProjectId(pid);

        // Populate Project-table fields
        const projectValues: Partial<FormData> = {
          project_name: p.project_name ?? "",
          short_description: p.short_description ?? "",
          full_description: p.full_description ?? "",
          tech_stack: p.tech_stack ?? "",
          github_repository: p.github_repository ? p.github_repository.split(",").filter(Boolean) : [],
          demo_link: p.demo_link ? p.demo_link.split(",").filter(Boolean) : [],
          demo_video_link: p.demo_video_link ? p.demo_video_link.split(",").filter(Boolean) : [],
          tracks: Array.isArray(p.tracks) ? p.tracks : [],
          is_preexisting_idea: p.is_preexisting_idea ?? false,
          project_category: Array.isArray(p.categories) && p.categories.length > 0 ? p.categories[0] : "",
          other_category: p.other_category ?? "",
        };

        // Fetch and populate build_games FormData fields
        try {
          const fdRes = await axios.get("/api/build-games/stage-data", {
            params: { project_id: pid },
          });
          const bg = fdRes.data.form_data?.build_games ?? {};
          form.reset({
            ...projectValues,
            bg_problem_statement: bg.problem_statement ?? "",
            bg_user_persona: bg.user_persona ?? "",
            bg_current_solutions: bg.current_solutions ?? "",
            bg_proposed_solution: bg.proposed_solution ?? "",
            bg_onchain_trigger: bg.onchain_trigger ?? "",
            bg_game_type: bg.game_type ?? "",
            bg_game_genre: bg.game_genre ?? "",
            bg_game_genre_other: bg.game_genre_other ?? "",
            bg_game_loop: bg.game_loop ?? "",
            bg_web3_gaming_integration: bg.web3_gaming_integration ?? "",
            bg_player_motivation: bg.player_motivation ?? "",
            bg_game_economy: bg.game_economy ?? "",
            bg_target_player: bg.target_player ?? "",
            bg_existing_project_plan: bg.existing_project_plan ?? "",
            bg_existing_achievements: bg.existing_achievements ?? "",
            bg_architecture_overview: bg.architecture_overview ?? "",
            bg_user_journey: bg.user_journey ?? "",
            bg_moscow_framework: bg.moscow_framework ?? "",
            bg_game_playable_state: bg.game_playable_state ?? "",
            bg_game_smart_contracts: bg.game_smart_contracts ?? "",
            bg_game_onboarding: bg.game_onboarding ?? "",
            bg_game_playtesting: bg.game_playtesting ?? "",
            bg_game_acquisition: bg.game_acquisition ?? "",
            bg_game_community: bg.game_community ?? "",
            bg_game_monetization: bg.game_monetization ?? "",
            bg_game_competitors: bg.game_competitors ?? "",
            bg_milestones: Array.isArray(bg.milestones) && bg.milestones.length > 0
              ? bg.milestones
              : [{ period: "", description: "" }],
            bg_summary: bg.summary ?? "",
            bg_support_needed: bg.support_needed ?? "",
            bg_game_metrics: bg.game_metrics ?? "",
            bg_game_vision: bg.game_vision ?? "",
          });
        } catch {
          // FormData doesn't exist yet — still apply project values
          form.reset(projectValues);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // ── Save logic ─────────────────────────────────────────────────────────────

  const saveCurrentForm = useCallback(async () => {
    if (!session?.user?.id) return;
    if (isSavingRef.current) return null; // block concurrent invocations (button + MembersComponent)
    isSavingRef.current = true;
    try {
    const data = form.getValues();

    // 1. Save Project-table fields
    const projectPayload = {
      project_name: data.project_name ?? "",
      short_description: data.short_description ?? "",
      full_description: data.full_description ?? "",
      tech_stack: data.tech_stack ?? "",
      github_repository: (data.github_repository ?? []).join(","),
      demo_link: (data.demo_link ?? []).join(","),
      demo_video_link: (data.demo_video_link ?? []).join(","),
      tracks: data.tracks ?? [],
      categories: data.project_category ? [data.project_category] : [],
      other_category: data.other_category ?? "",
      is_preexisting_idea: data.is_preexisting_idea ?? false,
      hackaton_id: HACKATHON_ID,
      user_id: session.user.id,
      is_winner: false,
      id: projectId,
      logo_url: "",
      cover_url: "",
      screenshots: [],
      isDraft: true,
    };

    const projectRes = await axios.post("/api/project/", projectPayload);
    const savedId =
      projectRes.data.project?.id ?? projectRes.data.id ?? projectId;
    if (savedId) setProjectId(savedId);

    // 2. Save build_games FormData fields (only if we have a project ID)
    if (savedId) {
      const buildGamesPayload = {
        project_id: savedId,
        form_data: {
          build_games: {
            problem_statement: data.bg_problem_statement ?? "",
            user_persona: data.bg_user_persona ?? "",
            current_solutions: data.bg_current_solutions ?? "",
            proposed_solution: data.bg_proposed_solution ?? "",
            onchain_trigger: data.bg_onchain_trigger ?? "",
            game_type: data.bg_game_type ?? "",
            game_genre: data.bg_game_genre ?? "",
            game_genre_other: data.bg_game_genre_other ?? "",
            game_loop: data.bg_game_loop ?? "",
            web3_gaming_integration: data.bg_web3_gaming_integration ?? "",
            player_motivation: data.bg_player_motivation ?? "",
            game_economy: data.bg_game_economy ?? "",
            target_player: data.bg_target_player ?? "",
            existing_project_plan: data.bg_existing_project_plan ?? "",
            existing_achievements: data.bg_existing_achievements ?? "",
            architecture_overview: data.bg_architecture_overview ?? "",
            user_journey: data.bg_user_journey ?? "",
            moscow_framework: data.bg_moscow_framework ?? "",
            game_playable_state: data.bg_game_playable_state ?? "",
            game_smart_contracts: data.bg_game_smart_contracts ?? "",
            game_onboarding: data.bg_game_onboarding ?? "",
            game_playtesting: data.bg_game_playtesting ?? "",
            game_acquisition: data.bg_game_acquisition ?? "",
            game_community: data.bg_game_community ?? "",
            game_monetization: data.bg_game_monetization ?? "",
            game_competitors: data.bg_game_competitors ?? "",
            milestones: (data.bg_milestones ?? []).filter(
              (m) => (m.period ?? "") !== "" || (m.description ?? "") !== ""
            ),
            summary: data.bg_summary ?? "",
            support_needed: data.bg_support_needed ?? "",
            game_metrics: data.bg_game_metrics ?? "",
            game_vision: data.bg_game_vision ?? "",
          },
        },
      };
      await axios.post("/api/build-games/stage-data", buildGamesPayload);
    }

    return savedId;
  } finally {
    isSavingRef.current = false;
  }
  }, [session?.user?.id, form, projectId]);

  const onSubmit = async () => {
    setIsSaving(true);
    try {
      await saveCurrentForm();
      setSuccess(true);
    } catch {
      toast({
        title: "Error saving submission",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStage = (n: number) => {
    if (n > stage) return;
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        next.add(n);
      }
      return next;
    });
  };

  const stageName = STAGE_NAMES[stage] ?? `Stage ${stage}`;

  // ── Loading / gate states ──────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#66acd6]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4 px-4">
        <CheckCircle2 className="w-16 h-16 text-[#66acd6]" />
        <h2 className="text-3xl font-semibold text-white">Submission Saved!</h2>
        <p className="text-white/70 max-w-md">
          Your {stageName} submission has been saved successfully. You can
          update it at any time before the deadline.
        </p>
        <div className="flex gap-4 mt-4 flex-wrap justify-center">
          <Button
            onClick={() => setSuccess(false)}
            variant="outline"
            className="border-[#66acd6]/30 text-white hover:bg-[#66acd6]/10"
          >
            Edit Submission
          </Button>
          <a href="/build-games">
            <Button className="bg-[#66acd6] text-[#152d44] hover:bg-[#7fc0e5]">
              Back to Build Games
            </Button>
          </a>
        </div>
      </div>
    );
  }

  // ── Section divider helper ─────────────────────────────────────────────────

  const SectionDivider = ({
    label,
    icon,
  }: {
    label: string;
    icon?: string;
  }) => (
    <div className="flex items-center gap-3 pt-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
        {icon} {label}
      </span>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );

  // ── Stage content renderers ────────────────────────────────────────────────

  const renderStageContent = (n: number) => {
    if (n === 1) {
      return (
        <div className="space-y-5">
          {/* ── Project Overview ── */}
          <SectionDivider label="Project Overview" />

          <FormField
            control={form.control}
            name="project_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Project Name <span className="text-[#66acd6]">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your project name"
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="short_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  One-sentence description{" "}
                  <span className="text-[#66acd6]">*</span>
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Summarize your project in one sentence (max 280 characters).
                </p>
                <FormControl>
                  <Textarea
                    placeholder="e.g. A decentralized lending protocol that lets users borrow against their NFTs without selling them."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[80px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Project Category ── */}
          <FormField
            control={form.control}
            name="project_category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Project Category
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Select the category that best describes your project. This determines which evaluation questions you'll answer.
                </p>
                <FormControl>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      "DeFi",
                      "Gaming",
                      "NFT / Digital Assets",
                      "Infrastructure",
                      "Social",
                      "DAO / Governance",
                      "Identity",
                      "Other",
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => field.onChange(cat)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          field.value === cat
                            ? "bg-[#66acd6]/15 border-[#66acd6] text-[#66acd6]"
                            : "bg-zinc-900/80 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("project_category") === "Other" && (
            <FormField
              control={form.control}
              name="other_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">
                    Please specify your category
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Describe your project category..."
                      className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* ── Existing Project ── */}
          <FormField
            control={form.control}
            name="is_preexisting_idea"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Is this an existing project?
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Did you start working on this idea before Build Games?
                </p>
                <FormControl>
                  <div className="flex gap-3 mt-1">
                    {[
                      { label: "No — new idea", value: false },
                      { label: "Yes — existing project", value: true },
                    ].map(({ label, value }) => (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => field.onChange(value)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          field.value === value
                            ? "bg-[#66acd6]/15 border-[#66acd6] text-[#66acd6]"
                            : "bg-zinc-900/80 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("is_preexisting_idea") === true && (
            <>
              <FormField
                control={form.control}
                name="bg_existing_project_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What do you plan to work on during this program?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe what you intend to build or improve over the course of Build Games.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. We plan to build the core smart contract layer and launch a beta with our first 100 users..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_existing_achievements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What are your achievements so far?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Share any traction, milestones, or progress you&apos;ve already made.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Deployed on testnet, 500 waitlist signups, completed audit, raised a pre-seed round..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* ── Gaming — only shown when category is Gaming ── */}
          {form.watch("project_category") === "Gaming" && (
            <>
              <SectionDivider label="🎮 Gaming" />

              <FormField
                control={form.control}
                name="bg_game_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What type of gaming project is this?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      This determines which evaluation questions apply to your submission.
                    </p>
                    <FormControl>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {[
                          {
                            value: "Consumer Game",
                            description: "You're building a game players will play",
                          },
                          {
                            value: "Gaming Infrastructure / Tooling",
                            description: "You're building tools, SDKs, or protocols for the gaming industry",
                          },
                        ].map(({ value, description }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => field.onChange(value)}
                            className={`flex-1 min-w-[200px] px-4 py-3 rounded-lg border text-left transition-colors ${
                              field.value === value
                                ? "bg-[#66acd6]/15 border-[#66acd6]"
                                : "bg-zinc-900/80 border-zinc-700 hover:border-zinc-500"
                            }`}
                          >
                            <p className={`text-sm font-medium ${field.value === value ? "text-[#66acd6]" : "text-zinc-300"}`}>
                              {value}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("bg_game_type") === "Consumer Game" && (<>
              <FormField
                control={form.control}
                name="bg_game_genre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Game genre
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Select the genre that best fits your game.
                    </p>
                    <FormControl>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {[
                          "Action / Adventure",
                          "RPG",
                          "Strategy",
                          "Puzzle",
                          "Card Game",
                          "Simulation",
                          "Sports",
                          "Multiplayer / Social",
                          "Other",
                        ].map((genre) => (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => field.onChange(genre)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              field.value === genre
                                ? "bg-[#66acd6]/15 border-[#66acd6] text-[#66acd6]"
                                : "bg-zinc-900/80 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                            }`}
                          >
                            {genre}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("bg_game_genre") === "Other" && (
                <FormField
                  control={form.control}
                  name="bg_game_genre_other"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white font-medium">
                        Please specify your genre
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Describe your game genre..."
                          className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="bg_game_loop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Core gameplay loop
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      What does a player do in a typical session? Walk us through the actions from launch to end of session.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Player enters a dungeon → fights enemies to earn loot → crafts items using on-chain resources → trades or equips them before the next run..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_web3_gaming_integration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Why does this game need to be on-chain?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      What does blockchain add that a traditional game server can&apos;t? Describe the specific on-chain mechanics and why they matter for the player experience.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Item ownership is verifiable and tradeable between players without a central intermediary. Each match outcome is recorded on-chain to prevent score manipulation..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_player_motivation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Player retention &amp; motivation
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      What keeps players coming back? Describe your engagement hook — progression systems, competition, social mechanics, collection, or other drivers.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Players level up characters with persistent on-chain stats, compete in weekly ranked seasons with token prizes, and collect rare NFT skins with provable scarcity..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_game_economy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      In-game economy &amp; sustainability
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe your in-game economy. If you use tokens or NFTs, how do you control inflation and ensure the economy stays healthy long-term?
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Tokens are earned through gameplay and burned on crafting and upgrades, creating a deflationary sink. NFT supply is fixed at 10,000. No pay-to-win mechanics..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_target_player"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Target player profile
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Who is your primary player? Are you targeting crypto-native gamers or onboarding traditional gamers to Web3? How does your UX reflect that?
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Targeting traditional mobile gamers aged 18–35 who are new to crypto. Wallet creation is abstracted — players sign up with email and never see a seed phrase..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </>)}
            </>
          )}

          {/* ── Problem Identification — hidden for consumer games ── */}
          {(form.watch("project_category") !== "Gaming" ||
            form.watch("bg_game_type") === "Gaming Infrastructure / Tooling") && (
            <>
              <SectionDivider label="‼️ Problem Identification" />

              <FormField
                control={form.control}
                name="bg_problem_statement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What problem are you addressing?{" "}
                      <span className="text-[#66acd6]">*</span>
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe the pain point or need your project aims to solve.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the core problem, its scope, and why it matters..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_user_persona"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Who experiences this problem?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe your primary user persona. What needs do they have?
                      Is it B2B or B2C?
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="Who is your target user? What are their goals, frustrations, and context?..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_current_solutions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      How is the problem currently solved (if at all)?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe existing workarounds or solutions before your
                      project.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="What alternatives exist today? Why are they insufficient?..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_proposed_solution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What is your proposed solution?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Explain how your project solves the problem better than
                      current solutions.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="How does your solution work and what makes it better?..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_onchain_trigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What triggers an on-chain transaction in your project?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe the key blockchain interactions in your solution.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder={`e.g. "Each time a user places a bid, a smart contract records the escrow on-chain. Each time a loan is repaid, the collateral is released automatically."`}
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* ── Video & Partnerships ── */}
          <SectionDivider label="Video & Partnerships" />

          <MultiLinkInput
            name="demo_video_link"
            label="2-Minute Pitch Video"
            placeholder="https://loom.com/share/... or https://youtube.com/..."
            validationMessage="Link to your YouTube or Loom video explaining your project idea."
            plainLabel
          />

          <FormField
            control={form.control}
            name="tracks"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Integration Partners
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Select the integration partners your project will use or build
                  on. This helps us match you with the right mentors.
                </p>
                <FormControl>
                  <MultiSelect
                    options={availableTracks}
                    selected={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="Select integration partners"
                    searchPlaceholder="Search partners"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Team & Collaboration ── */}
          <SectionDivider label="Team & Collaboration" />

          <div>
            <p className="text-zinc-400 text-sm mb-4">
              Invite teammates to join your project. They will receive an email
              invitation.
            </p>
            <MembersComponent
              project_id={projectId}
              hackaton_id={HACKATHON_ID}
              user_id={session?.user?.id}
              currentEmail={session?.user?.email ?? undefined}
              currentUserName={session?.user?.name ?? undefined}
              availableTracks={hackathonTracks}
              onHandleSave={saveCurrentForm}
              onProjectCreated={async () => {
                if (!session?.user?.id) return;
                const res = await axios.get("/api/project", {
                  params: {
                    hackathon_id: HACKATHON_ID,
                    user_id: session.user.id,
                  },
                });
                if (res.data.project?.id)
                  setProjectId(res.data.project.id);
              }}
              openjoinTeamDialog={openJoinTeamDialog}
              onOpenChange={setOpenJoinTeamDialog}
              openCurrentProject={openCurrentProject}
              setOpenCurrentProject={setOpenCurrentProject}
              teamName={joinTeamName || form.watch("project_name") || "My Project"}
              invite_stage={stage}
            />
          </div>
        </div>
      );
    }

    if (n === 2) {
      return (
        <div className="space-y-5">
          <MultiLinkInput
            name="github_repository"
            label="GitHub Repository"
            placeholder="https://github.com/username/repo"
            validationMessage="Link to your project's GitHub repository."
            plainLabel
          />

          <FormField
            control={form.control}
            name="tech_stack"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Technical Documentation
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Describe your tech stack, architecture decisions, and
                  implementation approach.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="Describe your technical stack, architecture decisions, and implementation approach..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[150px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bg_architecture_overview"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Architecture design overview
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Outline the main components, workflows, and technical
                  structure of your solution.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="Describe your system architecture: key components, data flow, integrations, on-chain vs off-chain logic..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[160px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bg_user_journey"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  How does a user interact with your solution from start to finish?
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Walk us through the full user journey step by step.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="Step 1: User lands on... Step 2: User connects wallet... Step 3:..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bg_moscow_framework"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  MoSCoW Framework — Feature Prioritization
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Analyze the most important features to build using the MoSCoW
                  framework: <strong className="text-zinc-300">Must Have</strong>,{" "}
                  <strong className="text-zinc-300">Should Have</strong>,{" "}
                  <strong className="text-zinc-300">Could Have</strong>,{" "}
                  <strong className="text-zinc-300">Won&apos;t Have</strong>.
                  Describe each category clearly.
                </p>
                <FormControl>
                  <Textarea
                    placeholder={`Must Have:\n- ...\n\nShould Have:\n- ...\n\nCould Have:\n- ...\n\nWon't Have:\n- ...`}
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[220px] resize-none font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <MultiLinkInput
            name="demo_video_link"
            label="Walkthrough Video"
            placeholder="https://loom.com/share/... or https://youtube.com/..."
            validationMessage="Link to a product walkthrough video (max 5 minutes) demonstrating your key features. This replaces your Stage 1 pitch video."
            plainLabel
          />

          <MultiLinkInput
            name="demo_link"
            label="Live Prototype Links"
            placeholder="https://your-app.com"
            plainLabel
          />

          {/* ── Gaming MVP — only for consumer games ── */}
          {form.watch("project_category") === "Gaming" &&
            form.watch("bg_game_type") === "Consumer Game" && (
            <>
              <SectionDivider label="🎮 Gaming MVP" />

              <FormField
                control={form.control}
                name="bg_game_playable_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      What is currently playable?
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Describe the state of your MVP. Which core mechanics can a player experience right now?
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Players can connect a wallet, enter a dungeon, fight enemies, and collect loot. The crafting system is mocked but not yet on-chain..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_game_smart_contracts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Smart contracts deployed
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Which contracts are live? Are they on testnet or mainnet? Link to the explorer if available.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Item ownership contract deployed on Fuji testnet (0x...). Loot drop randomness contract in progress. Explorer: snowtrace.io/..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_game_onboarding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      New player onboarding flow
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Walk us through how a brand-new player gets started. How do you handle wallet setup and the first session?
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="Step 1: Player visits the site and clicks Play. Step 2: Social login creates an embedded wallet automatically. Step 3: A tutorial dungeon runs them through core mechanics before any on-chain action..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_game_playtesting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Playtesting results
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Have you tested with real players? Share the top things they loved and the top friction points you discovered.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Tested with 12 players. Loved: combat feel, loot randomness. Struggled with: wallet prompt mid-session felt jarring, tutorial too long. We're now implementing session keys to remove mid-session signing..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>
      );
    }

    if (n === 3) {
      const bgCategory = form.watch("project_category");
      const isGamingConsumer = bgCategory === "Gaming" && form.watch("bg_game_type") === "Consumer Game";
      const gtm = isGamingConsumer
        ? {
            section: "🎮 Gaming GTM",
            acquisitionLabel: "Player acquisition strategy",
            acquisitionDesc: "How do you acquire your first 1,000 active players? Which channels — content, influencers, guilds, tournaments, referrals?",
            acquisitionPlaceholder: "e.g. Partner with 5 gaming guilds on Avalanche for a launch tournament with a $5k prize pool. Micro-influencer campaign on TikTok targeting Web3 gamers. Referral bonus: invite 3 friends → earn a rare NFT item...",
            communityLabel: "Community & guild strategy",
            communityDesc: "How are you building your player community? Discord, tournaments, ambassador programs, DAO governance for in-game decisions?",
            communityPlaceholder: "e.g. Weekly tournaments streamed on Twitch. Discord with 2,000 members and active guild channels. Community votes on new game modes each season via snapshot...",
            monetizationLabel: "Monetization model",
            monetizationDesc: "How does the game generate sustainable revenue? Describe primary and secondary market mechanics without compromising gameplay fairness.",
            monetizationPlaceholder: "e.g. Free-to-play with cosmetic NFT sales (no pay-to-win). 2.5% marketplace fee on player-to-player trades. Season pass ($9.99) for early access to new content. No token required to play...",
            competitorsLabel: "Competitive landscape",
            competitorsDesc: "Name 2–3 games you compete with directly. What makes players choose yours over them?",
            competitorsPlaceholder: "e.g. Gods Unchained (card game, larger player base but Ethereum fees). Pixels (farming game, similar audience but no combat). We differ by combining real-time combat with fully on-chain item ownership at near-zero gas on Avalanche...",
          }
        : {
            section: "📈 Go-to-Market",
            acquisitionLabel: "User acquisition strategy",
            acquisitionDesc: "How do you reach and convert your first users? Which channels — content, partnerships, referrals, community, or paid?",
            acquisitionPlaceholder: "e.g. Developer relations program targeting existing Web3 builders, partnership with 3 protocols for distribution, content marketing via technical blog posts and tutorials...",
            communityLabel: "Community strategy",
            communityDesc: "How are you building and engaging your community? Discord, forums, ambassador programs, governance, events?",
            communityPlaceholder: "e.g. Active Discord with dedicated support channels, monthly community calls, ambassador program rewarding top contributors, DAO governance for protocol decisions...",
            monetizationLabel: "Revenue & sustainability model",
            monetizationDesc: "How does your project generate sustainable revenue or value? Describe fees, subscriptions, token mechanics, or other monetization approaches.",
            monetizationPlaceholder: "e.g. 0.3% protocol fee on transactions, 20% of fees directed to treasury for grants, token holders receive fee-sharing after 12-month lockup...",
            competitorsLabel: "Competitive landscape",
            competitorsDesc: "Name 2–3 direct competitors or alternatives. What makes users choose your project over them?",
            competitorsPlaceholder: "e.g. Competitor A (larger user base but higher fees). Competitor B (similar feature set but no cross-chain). We differ by combining X with Y at near-zero cost on Avalanche...",
          };

      return (
        <div className="space-y-5">
          <FormField
            control={form.control}
            name="full_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Product Vision
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Where is your product headed long-term? Describe the future you're building toward.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="e.g. We're building the go-to platform for X. In 3 years we see ourselves as..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[200px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <MultiLinkInput
            name="demo_link"
            label="Supporting Documents / Links"
            placeholder="https://docs.google.com/..."
            plainLabel
          />

          {/* ── GTM — shown for all categories ── */}
          <>
            <SectionDivider label={gtm.section} />

            <div>
              <p className="text-white font-medium text-sm mb-1">Milestones &amp; Roadmap</p>
              <p className="text-zinc-400 text-sm mb-3">
                Add your key milestones by period.
              </p>
              <div className="space-y-2">
                {milestoneFields.map((mf, index) => (
                  <div
                    key={mf.id}
                    className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Controller
                        control={form.control}
                        name={`bg_milestones.${index}.period`}
                        render={({ field: f }) => (
                          <Input
                            {...f}
                            placeholder='Period — e.g. "Completed", "Q2 2026", "Q3 2026"'
                            className="flex-1 bg-transparent border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#66acd6] text-sm font-medium"
                          />
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(index)}
                        className="shrink-0 p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <Controller
                      control={form.control}
                      name={`bg_milestones.${index}.description`}
                      render={({ field: f }) => (
                        <Textarea
                          {...f}
                          placeholder={"- What you achieved or plan to achieve\n- Key deliverable\n- ..."}
                          className="bg-transparent border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#66acd6] min-h-[90px] resize-none text-sm font-mono"
                        />
                      )}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => appendMilestone({ period: "", description: "" })}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors py-2"
                >
                  <span className="w-5 h-5 rounded border border-zinc-700 flex items-center justify-center text-zinc-400 hover:border-zinc-500">+</span>
                  Add milestone
                </button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="bg_game_acquisition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">
                    {gtm.acquisitionLabel}
                  </FormLabel>
                  <p className="text-zinc-400 text-sm -mt-1">
                    {gtm.acquisitionDesc}
                  </p>
                  <FormControl>
                    <Textarea
                      placeholder={gtm.acquisitionPlaceholder}
                      className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bg_game_community"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">
                    {gtm.communityLabel}
                  </FormLabel>
                  <p className="text-zinc-400 text-sm -mt-1">
                    {gtm.communityDesc}
                  </p>
                  <FormControl>
                    <Textarea
                      placeholder={gtm.communityPlaceholder}
                      className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bg_game_monetization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">
                    {gtm.monetizationLabel}
                  </FormLabel>
                  <p className="text-zinc-400 text-sm -mt-1">
                    {gtm.monetizationDesc}
                  </p>
                  <FormControl>
                    <Textarea
                      placeholder={gtm.monetizationPlaceholder}
                      className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bg_game_competitors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">
                    {gtm.competitorsLabel}
                  </FormLabel>
                  <p className="text-zinc-400 text-sm -mt-1">
                    {gtm.competitorsDesc}
                  </p>
                  <FormControl>
                    <Textarea
                      placeholder={gtm.competitorsPlaceholder}
                      className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        </div>
      );
    }

    if (n === 4) {
      return (
        <div className="space-y-5">
          <MultiLinkInput
            name="demo_link"
            label="Pitch Recording & Slides"
            placeholder="https://docs.google.com/presentation/..."
            plainLabel
            description="Record your pitch again — this time you have up to 7 minutes. Use this as a dry-run for your live final pitch. Update it so it reflects the current state of your project, include a short demo, and share any information you think judges will want to know. Consider that the final judges have never seen your project before and have no context from previous stages."
          />

          <FormField
            control={form.control}
            name="bg_summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Project Summary
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Keep it short. Include your project&apos;s website, X (Twitter), and any other links or information about your team or your project that you think judges should know about.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="Brief summary of your project. Website: https://... | X: https://x.com/... | Any other relevant links or context..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[250px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bg_support_needed"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  What type of support do you need to succeed?
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Tell us what kind of support would make the biggest difference for your project — e.g. technical guidance, BD introductions, legal, marketing, funding, ecosystem partnerships.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="e.g. We need help with go-to-market strategy and introductions to potential partners in the DeFi space..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Gaming Finals — only for consumer games ── */}
          {form.watch("project_category") === "Gaming" &&
            form.watch("bg_game_type") === "Consumer Game" && (
            <>
              <SectionDivider label="🎮 Gaming Finals" />

              <FormField
                control={form.control}
                name="bg_game_metrics"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      Live player metrics &amp; traction
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Share your current numbers: daily active players, average session length, Day-1 / Day-7 / Day-30 retention, on-chain transaction volume.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. 340 DAU, avg session 22 min, D1 retention 61% / D7 38% / D30 18%. 12,400 on-chain transactions in the last 30 days. 1,800 unique wallet addresses..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[130px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bg_game_vision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white font-medium">
                      12-month vision
                    </FormLabel>
                    <p className="text-zinc-400 text-sm -mt-1">
                      Where do you want the game to be in 12 months? Set targets for player count, revenue, content expansion, and ecosystem integrations.
                    </p>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. 50k MAU by Q1 2027. Launch Season 2 with PvP ranked mode. Integrate with 2 Avalanche ecosystem protocols for in-game rewards. Mobile port in Q3. $500k ARR from marketplace fees and season passes..."
                        className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[140px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>
      );
    }

    return null;
  };

  // ── Accordion item ─────────────────────────────────────────────────────────

  const renderAccordionItem = (n: number) => {
    const isCurrent = n === stage;
    const isPast = n < stage;
    const isFuture = n > stage;
    const isOpen = openStages.has(n);

    return (
      <div
        key={n}
        className={cn(
          "rounded-xl border overflow-hidden transition-all",
          isCurrent && "border-[#66acd6]/30",
          isPast && "border-zinc-700/50",
          isFuture && "border-zinc-800/30 opacity-40 pointer-events-none"
        )}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => toggleStage(n)}
          disabled={isFuture}
          className={cn(
            "w-full flex items-center justify-between px-5 py-4 text-left transition-colors",
            isCurrent && "bg-[#66acd6]/5 hover:bg-[#66acd6]/8",
            isPast && "bg-zinc-900/60 hover:bg-zinc-800/60 cursor-pointer",
            isFuture && "bg-zinc-900/40 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0",
                isCurrent && "bg-[#66acd6] text-[#152d44]",
                isPast && "bg-zinc-700 text-zinc-300",
                isFuture && "bg-zinc-800 text-zinc-600"
              )}
            >
              {n}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isCurrent && "text-[#66acd6]",
                  isPast && "text-zinc-400",
                  isFuture && "text-zinc-600"
                )}
              >
                Stage {n} — {STAGE_SHORT_NAMES[n]}
              </span>

              {isCurrent && (
                <span className="text-xs text-[#66acd6] bg-[#66acd6]/10 px-2 py-0.5 rounded-full">
                  current stage
                </span>
              )}
              {isPast && (
                <span className="text-xs text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                  update if needed
                </span>
              )}
              {isFuture && (
                <span className="text-xs text-zinc-700">upcoming</span>
              )}
            </div>
          </div>

          <div className="shrink-0 ml-4">
            {isFuture ? (
              <Lock className="w-4 h-4 text-zinc-700" />
            ) : (
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  isOpen && "rotate-180",
                  isCurrent ? "text-[#66acd6]" : "text-zinc-500"
                )}
              />
            )}
          </div>
        </button>

        {/* Content */}
        {isOpen && !isFuture && (
          <div
            className={cn(
              "px-5 pb-6 pt-5 border-t",
              isCurrent ? "border-[#66acd6]/20" : "border-zinc-700/30"
            )}
          >
            {renderStageContent(n)}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Toaster />
      <InvalidInvitationComponent
        open={openInvalidInvitation}
        hackathonId={HACKATHON_ID}
        onOpenChange={setOpenInvalidInvitation}
      />

      {/* Page header */}
      <div className="mb-8">
        <div className="inline-block px-3 py-1 rounded-full bg-[#66acd6]/10 border border-[#66acd6]/30 text-[#66acd6] text-sm font-medium mb-4">
          {stageName}
        </div>
        <h2 className="text-3xl font-semibold text-white mb-3">
          Submit Your Work
        </h2>
        <p className="text-white/70 text-base leading-relaxed">
          {STAGE_DESCRIPTIONS[stage]}
        </p>
      </div>

      {projectId && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-[#66acd6]/10 border border-[#66acd6]/20 text-[#66acd6] text-sm">
          Previously saved data has been loaded. You can update your submission
          at any time.
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {[1, 2, 3, 4].map(renderAccordionItem)}

          <div className="pt-4">
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#66acd6] text-[#152d44] hover:bg-[#7fc0e5] font-semibold py-4 text-base h-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                `Save ${stageName} Submission`
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
