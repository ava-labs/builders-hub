"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import SubmitStep1 from "./SubmissionStep1";
import SubmitStep2 from "./SubmissionStep2";
import SubmitStep3 from "./SubmissionStep3";
import { useSubmissionForm, SubmissionForm } from "../hooks/useSubmissionForm";
import { useHackathonProject } from "../hooks/useHackathonProject";
import { JoinTeamDialog } from "../components/JoinTeamDialog";
import { ProgressBar } from "../components/ProgressBar";
import { StepNavigation } from "../components/StepNavigation";
import axios from "axios";
import { Tag, Users, Pickaxe, Image } from "lucide-react";

export default function GeneralComponent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(40);
  const [openJoinTeam, setOpenJoinTeam] = useState(false);
  const [teamName, setTeamName] = useState<string>("");
  const [isValidInvitation, setValidInvitation] = useState<boolean>(false);
  const { data: session } = useSession();
  const currentUser = session?.user;
  const hackathonId = searchParams?.hackathon ?? "";
  const invitationLink = searchParams?.invitation;

  const {
    form,
    projectId,
    originalImages,
    saveProject,
    handleSave,
    setFormData,
    setProjectId,
    handleSaveWithoutRoute
  } = useSubmissionForm(hackathonId as string);

  const {
    hackathon,
    project,
    timeLeft,
    loadData,
    setLoadData,
    getProject,
  } = useHackathonProject(hackathonId as string);

  const step1Fields: (keyof SubmissionForm)[] = [
    "project_name",
    "short_description",
    "full_description",
    "tracks",
  ];

  const step2Fields: (keyof SubmissionForm)[] = [
    "tech_stack",
    "github_repository",
    "explanation",
    "demo_link",
    "is_preexisting_idea",
  ];

  const handleStepChange = (newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
      setStep(newStep);
      if (newStep === 2) setProgress(70);
      if (newStep === 3) setProgress(100);
      if (newStep === 1) setProgress(40);
    }
  };

  const onSubmit = async (data: SubmissionForm) => {
    if (step < 3) {
      let valid = false;
      if (step === 1) {
        valid = await form.trigger(step1Fields);
      } else if (step === 2) {
        valid = await form.trigger(step2Fields);
      }
      if (valid) {
        setStep(step + 1);
        if (step + 1 === 2) setProgress(70);
        if (step + 1 === 3) setProgress(100);
      }
    } else {
      try {
        await saveProject(data);
      } catch (error) {
        console.error("Error uploading files or saving project:", error);
      }
    }
  };

  async function checkInvitation() {
    try {
      setLoadData(false);
      const response = await axios.get(
        `/api/project/check-invitation?invitationId=${invitationLink}`
      );
      setValidInvitation(response.data?.invitation.isValid ?? false);
      setProjectId(response.data?.project?.project_id ?? "");
      setOpenJoinTeam(response.data?.invitation.isConfirming ?? false);
      setLoadData(!response.data?.invitation.isConfirming);
      setTeamName(response.data?.project?.project_name ?? "");

    } catch (error) {
      console.error("Error checking invitation:", error);
      setValidInvitation(false);
    }
  }

  useEffect(() => {
    if (invitationLink) {
      checkInvitation();
    }
  }, [invitationLink]);

  useEffect(() => {
    if (project && loadData) {
      setFormData(project);
    }
  }, [project, loadData]);

  return (
    <div className="p-6 rounded-lg">

      <div className="mb-4">
        <h2 className="text-xl font-semibold">Submit Your Project { hackathon?.title ? " - "+ hackathon?.title : ""}</h2>
        <p className="text-gray-400 text-sm">
          Finalize and submit your project for review before the deadline.
          Complete all sections to ensure eligibility.
        </p>
      </div>

      <ProgressBar progress={progress} timeLeft={timeLeft} />

      <div className="flex mt-6 gap-4 space-x-12">
        <aside className="w-16 flex-col items-center dark:bg-zinc-900 border border-zinc-800 px-2 py-2 gap-2 hidden sm:flex">
          <div className="p-2 space-y-4">
            <Tag
              className="cursor-pointer"
              color={step === 1 ? "#F5F5F9" : "#4F4F55"}
              onClick={() => handleStepChange(1)}
            />
            <Users
              className="cursor-pointer"
              color={step === 1 ? "#F5F5F9" : "#4F4F55"}
              onClick={() => handleStepChange(1)}
            />
            <Pickaxe
              className="cursor-pointer"
              color={step === 2 ? "#F5F5F9" : "#4F4F55"}
              onClick={() => handleStepChange(2)}
            />
            <Image
              className="cursor-pointer"
              color={step === 3 ? "#F5F5F9" : "#4F4F55"}
              onClick={() => handleStepChange(3)}
            />
          </div>
        </aside>

        <div className="flex-1 flex flex-col gap-6">
          <section>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {step === 1 && (
                  <SubmitStep1
                    project_id={projectId}
                    hackaton_id={hackathonId as string}
                    user_id={currentUser?.id}
                    onProjectCreated={getProject}
                    onHandleSave={handleSaveWithoutRoute}
                    availableTracks={hackathon?.content?.tracks??[]}
                  />
                )}
                {step === 2 && <SubmitStep2 />}
                {step === 3 && <SubmitStep3 />}
                <Separator />
                <StepNavigation
                  currentStep={step}
                  onStepChange={handleStepChange}
                  onSubmit={form.handleSubmit(onSubmit)}
                  onSave={handleSave}
                  isLastStep={step === 3}
                />
              </form>
            </Form>
          </section>
        </div>
      </div>

      <JoinTeamDialog
        open={openJoinTeam}
        onOpenChange={setOpenJoinTeam}
        teamName={teamName}
        projectId={projectId}
        hackathonId={hackathonId as string}
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
