'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import SubmitStep1 from './SubmissionStep1';
import SubmitStep2 from './SubmissionStep2';
import SubmitStep3 from './SubmissionStep3';
import { useSubmissionFormSecure } from '../hooks/useSubmissionFormSecure';
import { useHackathonProject } from '../hooks/useHackathonProject';
import { ProgressBar } from '../components/ProgressBar';
import { StepNavigation } from '../components/StepNavigation';
import { Tag, Users, Pickaxe, Image, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { useRouter } from 'next/navigation';
import { useProjectSubmission } from '../context/ProjectSubmissionContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function GeneralSecureComponent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [teamName, setTeamName] = useState<string>('');
  
  const { data: session } = useSession();
  const currentUser = session?.user;
  const hackathonId = searchParams?.hackathon ?? '';
  const invitationLink = searchParams?.invitation;
  const { toast } = useToast();
  const router = useRouter();

  // Usar el contexto y hook seguros simplificados
  const { state: projectState } = useProjectSubmission();
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
  } = useSubmissionFormSecure();

  const { hackathon, project, timeLeft, getProject } = useHackathonProject(
    hackathonId as string,
    invitationLink as string
  );

  // Calcular progreso basado en completitud del formulario
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
    const subscription = form.watch((value: any, { name, type }: { name?: string; type?: string }) => {
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

  // Actualizar datos del formulario cuando cambie el proyecto
  useEffect(() => {
    if (project && isEditing) {
      setFormData(project);
      setTeamName(project.project_name || '');
    }
  }, [project, isEditing, setFormData]);

  const handleStepChange = (newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
      setStep(newStep);
    }
  };

  const onSubmit = async (data: any) => {
    if (!canSubmit) {
      toast({
        title: 'Cannot submit project',
        description: 'Project is not ready for submission. Please ensure you have proper permissions.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const success = await saveProject(data);
      if (success) {
        toast({
          title: 'Project submitted',
          description:
            'Your project has been successfully submitted. You will be redirected to the project showcase page.',
        });
        setTimeout(() => {
          router.push(`/showcase/${projectId}`);
        }, 3000);
      }
    } catch (error) {
      console.error('Error submitting project:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while submitting the project.',
        variant: 'destructive',
      });
    }
  };

  const onNextStep = async () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  // Mostrar estado de carga
  if (status === 'loading') {
    return (
      <div className="p-4 sm:p-6 rounded-lg max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Initializing project...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar estado de error
  if (status === 'error') {
    return (
      <div className="p-4 sm:p-6 rounded-lg max-w-7xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'An error occurred while initializing the project. Please try again.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Mostrar estado de acceso denegado
  if (!isEditing) {
    return (
      <div className="p-4 sm:p-6 rounded-lg max-w-7xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to edit this project or the project is not available.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className='p-4 sm:p-6 rounded-lg max-w-7xl mx-auto'>
      <Toaster />
      
      {/* Header */}
      <div className='mb-4'>
        <h2 className='text-lg sm:text-xl font-semibold break-words'>
          Submit Your Project {hackathon?.title ? ' - ' + hackathon?.title : ''}
        </h2>
        <p className='text-xs sm:text-sm text-gray-400'>
          Finalize and submit your project for review before the deadline.
          Complete all sections to ensure eligibility.
        </p>
        
        {/* Indicador de estado del proyecto (sin locks) */}
        {projectId && (
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✨ Project ready for editing
            </p>
          </div>
        )}
      </div>

      <ProgressBar progress={progress} timeLeft={timeLeft} />

      <div className='flex flex-col sm:flex-row mt-6 gap-4 sm:gap-4 sm:space-x-12'>
        {/* Sidebar para móvil */}
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

        {/* Sidebar para desktop */}
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
                    project_id={projectId || ''}
                    hackaton_id={hackathonId as string}
                    user_id={currentUser?.id}
                    onProjectCreated={getProject}
                    onHandleSave={handleSaveWithoutRoute}
                    availableTracks={hackathon?.content?.tracks ?? []}
                    openjoinTeamDialog={false}
                    openCurrentProject={false}
                    setOpenCurrentProject={() => {}}
                    onOpenChange={() => {}}
                    currentEmail={currentUser?.email}
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

      {/* Mostrar errores */}
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