'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import SubmitStep1 from './SubmissionStep1';
import SubmitStep2 from './SubmissionStep2';
import SubmitStep3 from './SubmissionStep3';
import {
  useSubmissionForm,
  SubmissionForm,
  FormSchema,
} from '../hooks/useSubmissionForm';
import { useHackathonProject } from '../hooks/useHackathonProject';
import { JoinTeamDialog } from '../components/JoinTeamDialog';
import { ProgressBar } from '../components/ProgressBar';
import { StepNavigation } from '../components/StepNavigation';
import axios from 'axios';
import { Tag, Users, Pickaxe, Image } from 'lucide-react';
import InvalidInvitationComponent from './InvalidInvitationDialog';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
export default function GeneralComponent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [openJoinTeam, setOpenJoinTeam] = useState(false);
  const [openInvalidInvitation, setOpenInvalidInvitation] = useState(false);
  const [teamName, setTeamName] = useState<string>('');
  const { data: session } = useSession();
  const currentUser = session?.user;
  const hackathonId = searchParams?.hackathon ?? '';
  const invitationLink = searchParams?.invitation;
  const { toast } = useToast();
  const router = useRouter();

  const {
    form,
    projectId,
    saveProject,
    handleSave,
    setFormData,
    setProjectId,
    handleSaveWithoutRoute,
  } = useSubmissionForm(hackathonId as string);

  const { hackathon, project, timeLeft, getProject } =
    useHackathonProject(hackathonId as string);

  const getAllFields = () => {
    return [
      'project_name',
      'short_description',
      'full_description',
      'tech_stack',
      'github_repository',
      'explanation',
      'demo_link',
      'logoFile',
      'coverFile',
      'screenshots',
      'demo_video_link',
      'tracks',
    ];
  };

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change') {
        const formValues = form.getValues();
        const allFields = getAllFields();
        const totalFields = allFields.length;
        let completedFields = 0;

        allFields.forEach((field) => {
          const fieldValue = formValues[field as keyof typeof formValues];
          if (Array.isArray(fieldValue)) {
            if (fieldValue && fieldValue.length > 0) {
              completedFields++;
            }
          } else if (
            typeof fieldValue === 'string' &&
            fieldValue.trim() !== ''
          ) {
            completedFields++;
          } else if (typeof fieldValue === 'boolean' && fieldValue === true) {
            completedFields++;
          } else if (
            fieldValue !== undefined &&
            fieldValue !== null &&
            fieldValue !== '' &&
            fieldValue !== false
          ) {
            completedFields++;
          }
        });

        setProgress(Math.round((completedFields / totalFields) * 100));
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleStepChange = (newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
      setStep(newStep);
    }
  };

  const onSubmit = async (data: SubmissionForm) => {
    try {
      await saveProject(data);
      toast({
        title: 'Project submitted',
        description:
          'Your project has been successfully submitted. You will be redirected to the project showcase page.',
      });
      setTimeout(() => {
        router.push(`/showcase/${projectId}`);
      }, 3000);
    } catch (error) {
      console.error('Error uploading files or saving project:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while saving the project.',
        variant: 'destructive',
      });
    }
  };

  const onNextStep = async () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  async function checkInvitation() {
    try {
  
      const response = await axios.get(
        `/api/project/check-invitation?invitation=${invitationLink}&user_id=${currentUser?.id}`
      );
      if (!response.data?.invitation.exists) {
        setOpenInvalidInvitation(!response.data?.invitation.isValid);
        return;
      }

      setProjectId(response.data?.project?.project_id ?? '');
      setOpenJoinTeam(response.data?.invitation.isConfirming ?? false);
   
      setTeamName(response.data?.project?.project_name ?? '');
    } catch (error) {
      console.error('Error checking invitation:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while checking the invitation.',
        variant: 'destructive',
      });
    }
  }

  useEffect(() => {
    if (invitationLink && currentUser) {
      checkInvitation();
    }
  }, [invitationLink, currentUser]);

  useEffect(() => {
    if (project ) {
      setFormData(project);
    }
  }, [project]);

  return (
    <div className='p-4 sm:p-6 rounded-lg max-w-7xl mx-auto'>
      <Toaster />
      <div className='mb-4'>
        <h2 className='text-lg sm:text-xl font-semibold break-words'>
          Submit Your Project {hackathon?.title ? ' - ' + hackathon?.title : ''}
        </h2>
        <p className='text-xs sm:text-sm text-gray-400'>
          Finalize and submit your project for review before the deadline.
          Complete all sections to ensure eligibility.
        </p>
      </div>

      <ProgressBar progress={progress} timeLeft={timeLeft} />

      <div className='flex flex-col sm:flex-row mt-6 gap-4 sm:gap-4 sm:space-x-12'>
        {/* Sidebar for mobile */}
        <div className='flex sm:hidden justify-center items-center gap-4 py-4 border-b border-zinc-200 dark:border-zinc-800'>
          <Tag
            className={`cursor-pointer ${
              step === 1
                ? 'text-zinc-900 dark:text-[#F5F5F9]'
                : 'text-zinc-500 dark:text-[#4F4F55]'
            }`}
            onClick={() => handleStepChange(1)}
          />
          <Users
            className={`cursor-pointer ${
              step === 1
                ? 'text-zinc-900 dark:text-[#F5F5F9]'
                : 'text-zinc-500 dark:text-[#4F4F55]'
            }`}
            onClick={() => handleStepChange(1)}
          />
          <Pickaxe
            className={`cursor-pointer ${
              step === 2
                ? 'text-zinc-900 dark:text-[#F5F5F9]'
                : 'text-zinc-500 dark:text-[#4F4F55]'
            }`}
            onClick={() => handleStepChange(2)}
          />
          <Image
            className={`cursor-pointer ${
              step === 3
                ? 'text-zinc-900 dark:text-[#F5F5F9]'
                : 'text-zinc-500 dark:text-[#4F4F55]'
            }`}
            onClick={() => handleStepChange(3)}
          />
        </div>

        {/* Sidebar for desktop */}
        <aside className='w-16 flex-col items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-2 gap-2 hidden sm:flex'>
          <div className='p-2 space-y-4'>
            <Tag
              className={`cursor-pointer ${
                step === 1
                  ? 'text-zinc-900 dark:text-[#F5F5F9]'
                  : 'text-zinc-500 dark:text-[#4F4F55]'
              }`}
              onClick={() => handleStepChange(1)}
            />
            <Users
              className={`cursor-pointer ${
                step === 1
                  ? 'text-zinc-900 dark:text-[#F5F5F9]'
                  : 'text-zinc-500 dark:text-[#4F4F55]'
              }`}
              onClick={() => handleStepChange(1)}
            />
            <Pickaxe
              className={`cursor-pointer ${
                step === 2
                  ? 'text-zinc-900 dark:text-[#F5F5F9]'
                  : 'text-zinc-500 dark:text-[#4F4F55]'
              }`}
              onClick={() => handleStepChange(2)}
            />
            <Image
              className={`cursor-pointer ${
                step === 3
                  ? 'text-zinc-900 dark:text-[#F5F5F9]'
                  : 'text-zinc-500 dark:text-[#4F4F55]'
              }`}
              onClick={() => handleStepChange(3)}
            />
          </div>
        </aside>

        <div className='flex-1 flex flex-col gap-4 sm:gap-6'>
          <section className='w-full'>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-4 sm:space-y-6'
              >
                {step === 1 && (
                  <SubmitStep1
                    project_id={projectId}
                    hackaton_id={hackathonId as string}
                    user_id={currentUser?.id}
                    onProjectCreated={getProject}
                    onHandleSave={handleSaveWithoutRoute}
                    availableTracks={hackathon?.content?.tracks ?? []}
                    openjoinTeamDialog={openJoinTeam}
                    onOpenChange={setOpenJoinTeam}
          
                    teamName={teamName}
                  />
                )}
                {step === 2 && <SubmitStep2 />}
                {step === 3 && <SubmitStep3 />}
                <Separator />
                <StepNavigation
                  currentStep={step}
                  onStepChange={handleStepChange}
                  onSave={handleSave}
                  isLastStep={step === 3}
                  onNextStep={onNextStep}
                />
              </form>
            </Form>
          </section>
        </div>
      </div>


      <InvalidInvitationComponent
        hackathonId={hackathonId as string}
        open={openInvalidInvitation}
        onOpenChange={setOpenInvalidInvitation}
      />
    </div>
  );
}
