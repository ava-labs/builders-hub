"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import SubmitStep1 from "./SubmissionStep1";
import SubmitStep2 from "./SubmissionStep2";
import SubmitStep3 from "./SubmissionStep3";
import { useSubmissionFormSecure } from "../hooks/useSubmissionFormSecure";
import { useHackathonProject } from "../hooks/useHackathonProject";
import { useDebounce } from "../hooks/useDebounce";
import { ProgressBar } from "../components/ProgressBar";
import { StepNavigation } from "../components/StepNavigation";
import { Tag, Users, Pickaxe, Image, AlertCircle, PartyPopper, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import { useProjectSubmission } from "../context/ProjectSubmissionContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InvalidInvitationComponent from "./InvalidInvitationDialog";
import { QuickRegistrationModal } from "./QuickRegistrationModal";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { REQUIRED_SUBMISSION_FIELDS, fieldComplete } from "@/lib/hackathons/submission-progress";
import type { SubmittedMember } from "@/types/project";
import Link from "next/link";
import { useLoginCompleteListener, triggerNewUserLogin } from "@/hooks/useLoginModal";

export default function GeneralSecureComponent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [submitted, setSubmitted] = useState<{
    projectName: string;
    hackathonTitle: string;
    members: SubmittedMember[];
  } | null>(null);

  const debouncedProgress = useDebounce(progress, 300); 

  const { data: session } = useSession();
  const currentUser = session?.user;
  const isPendingUser = !!session?.user?.id?.startsWith("pending_");

  const hackathonId = (searchParams?.event ?? searchParams?.hackathon ?? "") as string;
  const invitationLink = searchParams?.invitation;
  const projectIdParam = searchParams?.project as string | undefined;
  const { toast } = useToast();
  const router = useRouter();

  const { state: projectState, dispatch, actions } = useProjectSubmission();
  const teamName = projectState.teamName;
  const openJoinTeam = projectState.openJoinTeam;
  const openCurrentProject = projectState.openCurrentProject;
  const openInvalidInvitation = projectState.openInvalidInvitation;
  const {
    hackathon,
    project,
    timeLeft,
    submissionStatus,
    getProject,
  } = useHackathonProject(hackathonId as string, invitationLink as string);
  const lang = normalizeEventsLang(hackathon?.content?.language);
  const {
    form,
    projectId,
    isEditing,
    canSubmit,
    status,
    error,
    saveProject,
    handleSave,
    handleSaveWithoutRoute,
    setFormData,
  } = useSubmissionFormSecure(lang);
  
  // Load project by ID if projectIdParam exists and project is not already loaded
  useEffect(() => {
    const loadProjectById = async () => {
      if (projectIdParam && !project && isEditing && projectState.status === 'editing') {
        try {
          const response = await fetch(`/api/projects/${projectIdParam}`);
          if (response.ok) {
            const projectData = await response.json();
            if (projectData) {
              setFormData(projectData);
              dispatch({ type: "SET_PROJECT_ID", payload: projectData.id || "" });
              if (projectData.hackaton_id) {
                dispatch({ type: "SET_HACKATHON_ID", payload: projectData.hackaton_id });
              }
            }
          }
        } catch (error) {
          console.error("Error loading project by ID:", error);
        }
      }
    };
    loadProjectById();
  }, [projectIdParam, project, isEditing, projectState.status, setFormData, dispatch]);
  // Fields that enrich the progress bar but are not hard submission requirements.
  // REQUIRED_SUBMISSION_FIELDS (imported) is the authoritative required list.
  const FORM_PROGRESS_EXTRA_FIELDS = [
    "explanation",
    "logoFile",
    "coverFile",
    "screenshots",
    "demo_video_link",
  ];

  const getAllFields = (): string[] => {
    const hackathonId = (searchParams?.event ?? searchParams?.hackathon ?? "") as string;
    if (hackathonId) {
      return [...REQUIRED_SUBMISSION_FIELDS, ...FORM_PROGRESS_EXTRA_FIELDS];
    }
    // Standalone project: tracks is not applicable — replace with categories.
    return [
      ...REQUIRED_SUBMISSION_FIELDS.filter((f) => f !== "tracks"),
      "categories",
      ...FORM_PROGRESS_EXTRA_FIELDS,
    ];
  };

  // Extends the shared fieldComplete to also handle File objects (form uploads).
  const formFieldComplete = (value: unknown): boolean => {
    if (value instanceof File) return true;
    return fieldComplete(value);
  };

  const calculateProgress = (): number => {
    const formValues = form.getValues();
    const hackathonId = (searchParams?.event ?? searchParams?.hackathon ?? "") as string;
    const allFields = getAllFields();
    const raw = formValues as Record<string, unknown>;

    const completed = allFields.filter((field) => {
      if (field === "categories" && !hackathonId) {
        const cats = Array.isArray(raw.categories) ? raw.categories : [];
        if (cats.length === 0) return false;
        if (cats.includes("Other (Specify)")) {
          return typeof raw.other_category === "string" && raw.other_category.trim().length >= 1;
        }
        return true;
      }
      return formFieldComplete(raw[field]);
    });

    return Math.round((completed.length / allFields.length) * 100);
  };
  
  useEffect(() => {
    const subscription = form.watch(
      (value: any, { name, type }: { name?: string; type?: string }) => {
        if (type === "change") {
          setProgress(calculateProgress());
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (project && isEditing) {
      setProgress(calculateProgress());
    }
  }, [project, isEditing, form, calculateProgress]);

  useEffect(() => {
    if (project && isEditing) {
      setFormData(project);
      dispatch({ type: "SET_PROJECT_ID", payload: project.id || "" });
    }
  }, [project, isEditing, setFormData, dispatch]);
  
  // Load project data from context when loaded by ID
  useEffect(() => {
    if (projectState.projectData && isEditing && !project) {
      setFormData(projectState.projectData);
    }
  }, [projectState.projectData, isEditing, project, setFormData]);

  // If the user authenticated via OTP but hasn't accepted platform terms yet,
  // their session id is "pending_<email>" — no DB User record exists.
  // Trigger the terms modal directly (not the login form — they're already authenticated).
  useEffect(() => {
    if (isPendingUser) {
      triggerNewUserLogin({ userId: session?.user?.id, email: session?.user?.email, isNewUser: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPendingUser]);

  // After the user completes the full signup flow (terms + profile), reload
  // so the server refreshes the session and the form loads with a real user id.
  useLoginCompleteListener(() => {
    if (isPendingUser) {
      router.refresh();
    }
  });

  const handleStepChange = (newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
      setStep(newStep);
    }
  };

  const onSubmit = async (data: any, event?: React.BaseSyntheticEvent) => {
    console.log('🚀 onSubmit called with data:', data);

    // Explicitly prevent default form submission
    if (event) {
      event.preventDefault();
    }

    try {
      const result = await saveProject(data);

      if (result.success) {
        const savedMembers: SubmittedMember[] = result.project?.members ?? [];
        const fallbackMember: SubmittedMember = {
          id: "",
          status: "",
          name: currentUser?.name ?? null,
          email: currentUser?.email ?? null,
          role: "Lead",
        };
        setSubmitted({
          projectName: data.project_name ?? "",
          hackathonTitle: hackathon?.title ?? "",
          members: savedMembers.length > 0 ? savedMembers : [fallbackMember],
        });
      } else {
        console.error('❌ Save failed, result.success is false');
      }
    } catch (error) {
      console.error("❌ Error submitting project:", error);
      toast({
        title: t(lang, "submission.form.toast.error"),
        description:
          error instanceof Error
            ? error.message
            : t(lang, "submission.form.toast.errorDesc"),
        variant: "destructive",
      });
    }
  };

  const onNextStep = async () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };


  if (status === "error") {
    return (
      <div className="p-4 sm:p-6 rounded-lg max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || t(lang, "submission.form.error.init")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isPendingUser) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t(lang, "submission.pendingUser.message")}
          </p>
          <button
            type="button"
            onClick={() => triggerNewUserLogin({ userId: session?.user?.id, email: session?.user?.email, isNewUser: true })}
            className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {t(lang, "submission.pendingUser.cta")}
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    const hackathonId = (searchParams?.event ?? searchParams?.hackathon ?? "") as string;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-500/15 p-6">
              <PartyPopper className="size-14 text-emerald-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {t(lang, "submission.success.congrats")}
            </h1>
            <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">
              {t(lang, "submission.success.headline")}
            </h2>
          </div>

          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
            {t(lang, "submission.success.body")}{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {submitted.projectName}
            </span>{" "}
            {t(lang, "submission.success.body2")}{" "}
            <span className="font-semibold">{submitted.hackathonTitle}</span>.
          </div>

          {submitted.members.length > 0 && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700 text-sm text-left">
              {submitted.members.map((m, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    {(m.name ?? m.email ?? "?")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    {m.name && (
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{m.name}</p>
                    )}
                    {m.email && (
                      <p className={`truncate ${m.name ? "text-xs text-zinc-500" : "font-medium text-zinc-900 dark:text-zinc-100"}`}>
                        {m.email}
                      </p>
                    )}
                    {!m.name && !m.email && (
                      <p className="text-zinc-400 italic text-xs">—</p>
                    )}
                  </div>
                  {m.role && (
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{m.role}</span>
                  )}
                  <Mail className="shrink-0 size-4 text-zinc-400" />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/profile?tab=projects"
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t(lang, "submission.success.goToProfile")}
            </Link>
            {hackathonId && (
              <Link
                href={`/events/${hackathonId}`}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t(lang, "submission.success.backToEvent")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSubmitted(null)}
              className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              {t(lang, "submission.success.editProject")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 rounded-lg max-w-7xl mx-auto">
      <Toaster />

      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-semibold break-words">
          {hackathon?.title
            ? `${t(lang, "submission.form.title.withHackathon")} - ${hackathon.title}`
            : t(lang, "submission.form.title.standalone")}
        </h2>
        <p className="text-xs sm:text-sm text-gray-400">
          {hackathon?.title
            ? t(lang, "submission.form.subtitle.withHackathon")
            : t(lang, "submission.form.subtitle.standalone")}
        </p>
      </div>

      <ProgressBar progress={debouncedProgress} lang={lang} />

      <div className="flex flex-col sm:flex-row mt-6 gap-4 sm:gap-4 sm:space-x-12">
        {/* Sidebar para móvil */}
        <div className="flex sm:hidden justify-center items-center gap-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <Tag
            className={`cursor-pointer ${
              step === 1
                ? "text-zinc-900 dark:text-[#F5F5F9]"
                : "text-zinc-500 dark:text-[#4F4F55]"
            }`}
            onClick={() => handleStepChange(1)}
          />
          <Users
            className={`cursor-pointer ${
              step === 1
                ? "text-zinc-900 dark:text-[#F5F5F9]"
                : "text-zinc-500 dark:text-[#4F4F55]"
            }`}
            onClick={() => handleStepChange(1)}
          />
          <Pickaxe
            className={`cursor-pointer ${
              step === 2
                ? "text-zinc-900 dark:text-[#F5F5F9]"
                : "text-zinc-500 dark:text-[#4F4F55]"
            }`}
            onClick={() => handleStepChange(2)}
          />
          <Image
            className={`cursor-pointer ${
              step === 3
                ? "text-zinc-900 dark:text-[#F5F5F9]"
                : "text-zinc-500 dark:text-[#4F4F55]"
            }`}
            onClick={() => handleStepChange(3)}
          />
        </div>

        {/* Sidebar para desktop */}
        <aside className="w-16 flex-col items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-2 gap-2 hidden sm:flex">
          <div className="p-2 space-y-4">
            <Tag
              className={`cursor-pointer ${
                step === 1
                  ? "text-zinc-900 dark:text-[#F5F5F9]"
                  : "text-zinc-500 dark:text-[#4F4F55]"
              }`}
              onClick={() => handleStepChange(1)}
            />
            <Users
              className={`cursor-pointer ${
                step === 1
                  ? "text-zinc-900 dark:text-[#F5F5F9]"
                  : "text-zinc-500 dark:text-[#4F4F55]"
              }`}
              onClick={() => handleStepChange(1)}
            />
            <Pickaxe
              className={`cursor-pointer ${
                step === 2
                  ? "text-zinc-900 dark:text-[#F5F5F9]"
                  : "text-zinc-500 dark:text-[#4F4F55]"
              }`}
              onClick={() => handleStepChange(2)}
            />
            <Image
              className={`cursor-pointer ${
                step === 3
                  ? "text-zinc-900 dark:text-[#F5F5F9]"
                  : "text-zinc-500 dark:text-[#4F4F55]"
              }`}
              onClick={() => handleStepChange(3)}
            />
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-4 sm:gap-6">
          {/* Submission-window banner. Post-close: show read-only banner. */}
          {submissionStatus === "closed" && (
            <div className="rounded-md border border-zinc-500/40 bg-zinc-500/10 p-4">
              <h3 className="font-semibold mb-1">
                {t(lang, "submission.status.closedTitle")}
              </h3>
              <p className="text-sm text-zinc-300">
                {t(lang, "submission.status.closedDesc")}
              </p>
            </div>
          )}
          <section className={`w-full ${submissionStatus !== "open" ? "opacity-60 pointer-events-none" : ""}`}>
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  console.log('📝 Form onSubmit event triggered');
                  e.preventDefault();
                  if (submissionStatus !== "open") return;
                  form.handleSubmit(onSubmit)(e);
                }}
                className="space-y-4 sm:space-y-6"
              >
                {step === 1 && (
                  <SubmitStep1
                    project_id={projectId || ""}
                    hackaton_id={hackathonId as string}
                    user_id={currentUser?.id}
                    onProjectCreated={getProject}
                    onHandleSave={async () => {
                      await handleSaveWithoutRoute();
                    }}
                    availableTracks={hackathon?.content?.tracks ?? []}
                    openjoinTeamDialog={openJoinTeam}
                    openCurrentProject={openCurrentProject}
                    setOpenCurrentProject={(open) =>
                      dispatch({
                        type: "SET_OPEN_CURRENT_PROJECT",
                        payload: open,
                      })
                    }
                    onOpenChange={(open) =>
                      dispatch({ type: "SET_OPEN_JOIN_TEAM", payload: open })
                    }
                    currentEmail={currentUser?.email}
                    currentUserName={currentUser?.name || undefined}
                    teamName={teamName}
                    lang={lang}
                  />
                )}
                {step === 2 && (
                  <SubmitStep2
                    lang={lang}
                    availableTechStack={hackathon?.content?.tech_stack_options ?? []}
                  />
                )}
                {step === 3 && <SubmitStep3 lang={lang} />}

                <Separator />

                <StepNavigation
                  currentStep={step}
                  onStepChange={handleStepChange}
                  onSave={handleSave}
                  isLastStep={step === 3}
                  onNextStep={onNextStep}
                  lang={lang}
                />
              </form>
            </Form>
          </section>
        </div>
      </div>
  

      <InvalidInvitationComponent
        hackathonId={hackathonId as string}
        open={openInvalidInvitation}
        onOpenChange={(open) =>
          dispatch({ type: "SET_OPEN_INVALID_INVITATION", payload: open })
        }
        lang={lang}
      />

      <QuickRegistrationModal
        open={projectState.showRegistrationModal}
        hackathonTitle={hackathon?.title}
        lang={lang}
        onConfirm={(regData) => {
          actions.submitWithRegistration(regData).then((result) => {
            if (result.success) {
              const savedMembers: SubmittedMember[] = result.project?.members ?? [];
              const fallbackMember: SubmittedMember = {
                id: "",
                status: "",
                name: currentUser?.name ?? null,
                email: currentUser?.email ?? null,
                role: 'Lead',
              };
              setSubmitted({
                projectName: projectState.pendingSubmitData?.project_name ?? '',
                hackathonTitle: hackathon?.title ?? '',
                members: savedMembers.length > 0 ? savedMembers : [fallbackMember],
              });
            }
          });
        }}
        onCancel={() => actions.cancelRegistrationModal()}
      />
      {error && (
        <div className="mt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
