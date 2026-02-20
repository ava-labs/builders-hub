"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { MultiLinkInput } from "@/components/hackathons/project-submission/components/MultiLinkInput";
import MembersComponent from "@/components/hackathons/project-submission/components/Members";
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
  2: "Share your GitHub repository, technical documentation, and a product walkthrough video demonstrating your key features.",
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
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<
    { label: string; value: string }[]
  >([]);
  const [hackathonTracks, setHackathonTracks] = useState<Track[]>([]);
  const [openStages, setOpenStages] = useState<Set<number>>(
    () => new Set([stage])
  );

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
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
    },
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/build-games");
    }
  }, [status, router]);

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
            bg_existing_project_plan: bg.existing_project_plan ?? "",
            bg_existing_achievements: bg.existing_achievements ?? "",
            bg_architecture_overview: bg.architecture_overview ?? "",
            bg_user_journey: bg.user_journey ?? "",
            bg_moscow_framework: bg.moscow_framework ?? "",
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
            existing_project_plan: data.bg_existing_project_plan ?? "",
            existing_achievements: data.bg_existing_achievements ?? "",
            architecture_overview: data.bg_architecture_overview ?? "",
            user_journey: data.bg_user_journey ?? "",
            moscow_framework: data.bg_moscow_framework ?? "",
          },
        },
      };
      await axios.post("/api/build-games/stage-data", buildGamesPayload);
    }

    return savedId;
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

          {/* ── Problem Identification ── */}
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

          {/* ── Video & Partnerships ── */}
          <SectionDivider label="Video & Partnerships" />

          <MultiLinkInput
            name="demo_video_link"
            label="1-Minute Pitch Video"
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
              openjoinTeamDialog={false}
              onOpenChange={() => {}}
              openCurrentProject={false}
              setOpenCurrentProject={() => {}}
              teamName={form.watch("project_name") || "My Project"}
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
            validationMessage="Link to a product walkthrough video demonstrating your key features. This replaces your Stage 1 pitch video."
            plainLabel
          />

          <MultiLinkInput
            name="demo_link"
            label="Live Prototype Links"
            placeholder="https://your-app.com"
            plainLabel
          />
        </div>
      );
    }

    if (n === 3) {
      return (
        <div className="space-y-5">
          <FormField
            control={form.control}
            name="full_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  GTM Plan &amp; Vision
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Include your go-to-market plan, growth strategy, target user
                  personas, competitive analysis, and long-term product vision.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="Describe your go-to-market strategy, growth plan, target users, competitive landscape, and long-term vision..."
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
        </div>
      );
    }

    if (n === 4) {
      return (
        <div className="space-y-5">
          <MultiLinkInput
            name="demo_link"
            label="Pitch Deck & Demo Links"
            placeholder="https://docs.google.com/presentation/..."
            plainLabel
          />

          <FormField
            control={form.control}
            name="full_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Complete Project Documentation
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Provide complete documentation covering your project&apos;s
                  technical implementation, business model, and traction.
                </p>
                <FormControl>
                  <Textarea
                    placeholder="Complete documentation of your project: technical implementation, business model, user traction, roadmap..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6] min-h-[250px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
