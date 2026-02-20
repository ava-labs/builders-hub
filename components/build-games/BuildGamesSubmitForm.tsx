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
  AlertCircle,
  ChevronDown,
  Lock,
} from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
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
  1: "Submit your 1-minute pitch video explaining your project idea, target problem, solution approach, and value proposition.",
  2: "Share your GitHub repository, technical documentation, and a product walkthrough video demonstrating your key features.",
  3: "Submit your go-to-market plan, growth strategy, target user personas, competitive analysis, and long-term product vision.",
  4: "Provide your pitch deck, demo links, and complete project documentation for the final live presentation.",
};

const FormSchema = z.object({
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
  github_repository: z.string().optional().or(z.literal("")),
  demo_link: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  demo_video_link: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  tracks: z.array(z.string()).optional(),
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
  const [hasApplied, setHasApplied] = useState<boolean | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [availableTracks, setAvailableTracks] = useState<
    { label: string; value: string }[]
  >([]);
  const [hackathonTracks, setHackathonTracks] = useState<Track[]>([]);
  // Current stage open by default; previous stages collapsed
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
      github_repository: "",
      demo_link: "",
      demo_video_link: "",
      tracks: [],
    },
  });

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/build-games");
    }
  }, [status, router]);

  // Check application status
  useEffect(() => {
    if (status !== "authenticated") return;
    axios
      .get("/api/build-games/status")
      .then((res) => setHasApplied(res.data.hasApplied))
      .catch(() => setHasApplied(false))
      .finally(() => setLoadingStatus(false));
  }, [status]);

  // Fetch hackathon tracks for Integration Partners
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

  // Load existing project to pre-populate the form
  useEffect(() => {
    if (!session?.user?.id || hasApplied !== true) return;
    axios
      .get("/api/project", {
        params: { hackathon_id: HACKATHON_ID, user_id: session.user.id },
      })
      .then((res) => {
        if (res.data.project) {
          const p = res.data.project;
          setProjectId(p.id ?? "");
          form.reset({
            project_name: p.project_name ?? "",
            short_description: p.short_description ?? "",
            full_description: p.full_description ?? "",
            tech_stack: p.tech_stack ?? "",
            github_repository: p.github_repository ?? "",
            demo_link: p.demo_link ? p.demo_link.split(",")[0] : "",
            demo_video_link: p.demo_video_link ?? "",
            tracks: Array.isArray(p.tracks) ? p.tracks : [],
          });
        }
      })
      .catch(() => {});
  }, [hasApplied, session?.user?.id]);

  // Shared save logic (used by submit button and MembersComponent.onHandleSave)
  const saveCurrentForm = useCallback(async () => {
    if (!session?.user?.id) return;
    const data = form.getValues();
    const payload = {
      project_name: data.project_name ?? "",
      short_description: data.short_description ?? "",
      full_description: data.full_description ?? "",
      tech_stack: data.tech_stack ?? "",
      github_repository: data.github_repository ?? "",
      demo_link: data.demo_link ?? "",
      demo_video_link: data.demo_video_link ?? "",
      tracks: data.tracks ?? [],
      hackaton_id: HACKATHON_ID,
      user_id: session.user.id,
      is_winner: false,
      id: projectId,
      logo_url: "",
      cover_url: "",
      screenshots: [],
      isDraft: true,
    };
    const res = await axios.post("/api/project/", payload);
    const savedId = res.data.project?.id ?? res.data.id ?? projectId;
    if (savedId) setProjectId(savedId);
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
    if (n > stage) return; // future stages are locked
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

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === "loading" || (status === "authenticated" && loadingStatus)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#66acd6]" />
      </div>
    );
  }

  // ── Access gate ────────────────────────────────────────────────────────────
  if (hasApplied === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-yellow-400" />
        <h2 className="text-2xl font-semibold text-white">Access Restricted</h2>
        <p className="text-white/70 max-w-md">
          You must be an accepted Build Games participant to submit. If you
          haven&apos;t applied yet, please{" "}
          <a href="/build-games/apply" className="text-[#66acd6] underline">
            apply here
          </a>
          .
        </p>
        <a href="/build-games">
          <Button
            variant="outline"
            className="border-[#66acd6]/30 text-white hover:bg-[#66acd6]/10 mt-2"
          >
            Back to Build Games
          </Button>
        </a>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
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

  // ── Stage content renderers ────────────────────────────────────────────────

  const renderStageContent = (n: number, isOpen: boolean) => {
    if (!isOpen) return null;

    if (n === 1) {
      return (
        <div className="space-y-5">
          <FormField
            control={form.control}
            name="project_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Project Name
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
                  Idea &amp; Problem Statement
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Describe your idea, the problem it solves, and your value
                  proposition (max 280 characters).
                </p>
                <FormControl>
                  <Textarea
                    placeholder="What is your idea? What problem does it solve? What is the value proposition?"
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
            name="demo_video_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  1-Minute Pitch Video
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Link to your YouTube or Loom video explaining your project
                  idea.
                </p>
                <FormControl>
                  <Input
                    placeholder="https://loom.com/share/... or https://youtube.com/..."
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

          {/* Team & Collaboration — always shown when Stage 1 is open */}
          <div className="pt-2">
            <div className="mb-4">
              <h3 className="text-white font-medium text-base">
                Team &amp; Collaboration
              </h3>
              <p className="text-zinc-400 text-sm mt-1">
                Invite teammates to join your project. They will receive an
                email invitation.
              </p>
            </div>
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
            />
          </div>
        </div>
      );
    }

    if (n === 2) {
      return (
        <div className="space-y-5">
          <FormField
            control={form.control}
            name="github_repository"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  GitHub Repository
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Link to your project&apos;s GitHub repository.
                </p>
                <FormControl>
                  <Input
                    placeholder="https://github.com/username/repo"
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
            name="demo_video_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Walkthrough Video
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Link to a product walkthrough video demonstrating your key
                  features. This replaces your Stage 1 pitch video.
                </p>
                <FormControl>
                  <Input
                    placeholder="https://loom.com/share/... or https://youtube.com/..."
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
            name="demo_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Live Prototype Link
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Link to your live prototype or deployed app.
                </p>
                <FormControl>
                  <Input
                    placeholder="https://your-app.com"
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
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

          <FormField
            control={form.control}
            name="demo_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Supporting Documents / Links
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Link to supporting documents, presentations, or other
                  resources.
                </p>
                <FormControl>
                  <Input
                    placeholder="https://docs.google.com/..."
                    className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#66acd6]"
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

    if (n === 4) {
      return (
        <div className="space-y-5">
          <FormField
            control={form.control}
            name="demo_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white font-medium">
                  Pitch Deck &amp; Demo Links
                </FormLabel>
                <p className="text-zinc-400 text-sm -mt-1">
                  Link to your pitch deck and live demo.
                </p>
                <FormControl>
                  <Input
                    placeholder="https://docs.google.com/presentation/..."
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
            {/* Stage number circle */}
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
            {renderStageContent(n, isOpen)}
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
