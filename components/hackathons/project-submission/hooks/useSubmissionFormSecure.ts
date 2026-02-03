'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useProjectSubmission } from '../context/ProjectSubmissionContext';
import { useRouter } from 'next/navigation';
// Base schema without refinements - needed for .pick() to work
const BaseFormSchema = z.object({
  project_name: z
    .string()
    .min(2, { message: 'Project Name must be at least 2 characters' })
    .max(60, { message: 'Max 60 characters allowed' }),
  short_description: z
    .string()
    .min(30, { message: 'Short description must be at least 30 characters' })
    .max(280, { message: 'Max 280 characters allowed' }),
  full_description: z
    .string()
    .min(30, { message: 'Full description must be at least 30 characters' }),
  tech_stack: z
    .string()
    .min(30, { message: 'Tech stack must be at least 30 characters' }),
  github_repository: z.preprocess(
    (val) => {
      if (!val) return [];
      if (typeof val === 'string') return [];
      return val;
    },
    z.array(z.string().min(1, { message: 'Repository link is required' }))
      .min(1, { message: 'At least one link is required' })
      .refine((links) => new Set(links).size === links.length, {
        message: 'Duplicate repository links are not allowed',
      })
      .superRefine((links, ctx) => {
        const invalidLinks = links.filter((link) => {
          if (link.startsWith('http')) {
            try { new URL(link); return false; } catch { return true; }
          }
          return link.trim().length === 0;
        });

        if (invalidLinks.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please enter valid links (URLs or other formats)',
            path: [],
          });
        }
      })
  ),
  explanation: z.string().optional(),
  demo_link: z.preprocess(
    (val) => {
      if (!val) return [];
      if (typeof val === 'string') return [];
      return val;
    },
    z.array(
      z.string()
        .min(1, { message: 'Demo link cannot be empty' })
    )
      .min(1, { message: 'At least one demo link is required' })
      .refine(
        (links) => {
          const uniqueLinks = new Set(links);
          return uniqueLinks.size === links.length;
        },
        { message: 'Duplicate demo links are not allowed' }
      )
      .refine(
        (links) => {
          return links.every(url => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          });
        },
        { message: 'Please enter a valid URL' }
      )
  ),
  is_preexisting_idea: z.boolean(),
  logoFile: z.any().optional(),
  coverFile: z.any().optional(),
  screenshots: z.any().optional(),
  demo_video_link: z
    .string()
    .url({ message: 'Please enter a valid URL' })
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true;
        try {
          const url = new URL(val);
          return (
            url.hostname.includes('youtube.com') ||
            url.hostname.includes('youtu.be') ||
            url.hostname.includes('loom.com')
          );
        } catch {
          return false;
        }
      },
      { message: 'Please enter a valid YouTube or Loom URL' }
    ),
  tracks: z.array(z.string()).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
  other_category: z.string().optional(),
  logo_url: z.string().optional(),
  cover_url: z.string().optional(),
  hackaton_id: z.string().optional(),
  user_id: z.string().optional(),
  is_winner: z.boolean().optional(),
  isDraft: z.boolean().optional(),
});

// Step schemas created from base schema (before refinements)
export const Step1Schema = BaseFormSchema.pick({
  project_name: true,
  short_description: true,
  full_description: true,
  tracks: true,
  categories: true,
  other_category: true,
  hackaton_id: true,
}).superRefine((data, ctx) => {
  // Validación condicional para tracks cuando hay hackathon_id
  if (data.hackaton_id) {
    if (!data.tracks || data.tracks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one track is required when submitting to a hackathon',
        path: ['tracks'],
      });
    }
  }
  
  // Validación para other_category si se selecciona "Other (Specify)"
  if (data.categories && data.categories.includes('Other (Specify)')) {
    if (!data.other_category || data.other_category.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please specify the other category',
        path: ['other_category'],
      });
    }
  }
});

export const Step2Schema = BaseFormSchema.pick({
  tech_stack: true,
  github_repository: true,
  explanation: true,
  demo_link: true,
  is_preexisting_idea: true,
}).refine(
  (data) => {
    if (data.is_preexisting_idea) {
      return data.explanation && data.explanation.length >= 2;
    }
    return true;
  },
  {
    message: 'explanation is required when the idea is pre-existing',
    path: ['explanation'],
  }
);

// Full schema with all refinements
export const FormSchema = BaseFormSchema
  .refine(
    (data) => {
      if (data.is_preexisting_idea) {
        return data.explanation && data.explanation.length >= 2;
      }
      return true;
    },
    {
      message: 'explanation is required when the idea is pre-existing',
      path: ['explanation'],
    }
  )
  .refine(
    (data) => {
      // Si hay hackathon_id, tracks es requerido
      if (data.hackaton_id) {
        return data.tracks && data.tracks.length > 0;
      }
      return true;
    },
    {
      message: 'At least one track is required when submitting to a hackathon',
      path: ['tracks'],
    }
  )
  .refine(
    (data) => {
      // Si se selecciona "Other (Specify)", other_category es requerido
      if (data.categories && data.categories.includes('Other (Specify)')) {
        return data.other_category && data.other_category.trim().length >= 2;
      }
      return true;
    },
    {
      message: 'Please specify the other category',
      path: ['other_category'],
    }
  );

export type SubmissionForm = z.infer<typeof FormSchema>;
export const useSubmissionFormSecure = () => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { state, actions } = useProjectSubmission();
  const router = useRouter();
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [originalImages, setOriginalImages] = useState<{
    logoFile?: string;
    coverFile?: string;
    screenshots?: string[];
  }>({});

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(FormSchema),
    reValidateMode: 'onChange',
    mode: 'onSubmit',
    defaultValues: {
      project_name: '',
      short_description: '',
      full_description: '',
      tech_stack: '',
      tracks: [],
      categories: [],
      other_category: '',
      is_preexisting_idea: false,
      github_repository: [],
      demo_link: [],
      explanation: '',
      demo_video_link: '',
    },
  });

  // Allow submission even without hackathon - projects can be standalone
  const canSubmit = state.isEditing;

  useEffect(() => {
    const step1Fields: (keyof SubmissionForm)[] = [
      "project_name",
      "short_description",
      "full_description",
      "tracks",
      "categories",
      "other_category",
    ];

    const step2Fields: (keyof SubmissionForm)[] = [
      "tech_stack",
      "github_repository",
      "explanation",
      "demo_link",
      "is_preexisting_idea",
    ];

    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change' && name) {
        const fieldName = name as keyof SubmissionForm;
        if (form.formState.errors[fieldName]) {
          const allFields = [...step1Fields, ...step2Fields];

          if (allFields.includes(fieldName)) {

            if (timersRef.current[fieldName]) {
              clearTimeout(timersRef.current[fieldName]);
            }

            timersRef.current[fieldName] = setTimeout(() => {
              // Use BaseFormSchema for .pick() since FormSchema has refinements
              const schema = BaseFormSchema.pick({ [fieldName]: true } as any);

              schema.safeParseAsync(form.getValues()).then(result => {
                if (result.success) {
                  form.clearErrors(fieldName);
                } else {
                  const fieldError = result.error.issues.find(
                    issue => issue.path[0] === fieldName
                  );

                  if (!fieldError) {
                    form.clearErrors(fieldName);
                  }
                }
              });
            }, 300);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [form]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    // hackaton_id is optional - only include if exists
    if (state.hackathonId) {
      formData.append('hackaton_id', state.hackathonId);
    }
    formData.append('user_id', session?.user?.id || '');

    try {
      const response = await axios.post('/api/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.url;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Error uploading file';
      toast({
        title: 'Error uploading file',
        description: message,
        variant: 'destructive',
      });
      throw new Error(message);
    }
  }, [state.hackathonId, session?.user?.id, toast]);

  const replaceImage = useCallback(async (
    oldImageUrl: string,
    newFile: File
  ): Promise<string> => {

    const fileName = oldImageUrl.split('/').pop();
    if (!fileName) throw new Error('Invalid old image URL');

    try {
      await axios.delete('/api/file', {
        params: {
          fileName,
          ...(state.hackathonId && { hackaton_id: state.hackathonId }),
          user_id: session?.user?.id
        }
      });
      const newUrl = await uploadFile(newFile);

      toast({
        title: 'Image replaced',
        description: 'The image has been replaced successfully.',
      });
      return newUrl;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Error replacing image';
      toast({
        title: 'Error replacing image',
        description: message,
        variant: 'destructive',
      });
      throw new Error(message);
    }
  }, [state.hackathonId, session?.user?.id, uploadFile, toast]);

  const deleteImage = useCallback(async (oldImageUrl: string): Promise<void> => {
    const fileName = oldImageUrl.split('/').pop();
    if (!fileName) throw new Error('Invalid old image URL');

    try {
      const params = new URLSearchParams({
        fileName: encodeURIComponent(fileName),
        user_id: session?.user?.id || ''
      });
      if (state.hackathonId) {
        params.append('hackaton_id', state.hackathonId);
      }
      await fetch(`/api/file?${params.toString()}`, {
        method: 'DELETE',
      });

      toast({
        title: 'Image deleted',
        description: 'The image has been deleted successfully.',
      });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Error deleting image';
      toast({
        title: 'Error deleting image',
        description: message,
        variant: 'destructive',
      });
      throw new Error(message);
    }
  }, [state.hackathonId, session?.user?.id, toast]);

  const saveProject = useCallback(async (data: SubmissionForm): Promise<boolean> => {
    try {

      if (!canSubmit) {
        throw new Error('Project is not ready for submission');
      }

      const uploadedFiles = {
        logoFileUrl:
          data.logoFile &&
            (!Array.isArray(data.logoFile) || data.logoFile.length > 0)
            ? typeof data.logoFile === 'string'
              ? data.logoFile
              : originalImages.logoFile
                ? await replaceImage(originalImages.logoFile, data.logoFile)
                : await uploadFile(data.logoFile)
            : originalImages.logoFile
              ? (await deleteImage(originalImages.logoFile), null)
              : null,

        coverFileUrl:
          data.coverFile &&
            (!Array.isArray(data.coverFile) || data.coverFile.length > 0)
            ? typeof data.coverFile === 'string'
              ? data.coverFile
              : originalImages.coverFile
                ? await replaceImage(originalImages.coverFile, data.coverFile)
                : await uploadFile(data.coverFile)
            : originalImages.coverFile
              ? (await deleteImage(originalImages.coverFile), null)
              : null,

        screenshotsUrls:
          data.screenshots &&
            Array.isArray(data.screenshots) &&
            data.screenshots.length > 0
            ? await Promise.all(
              data.screenshots.map(async (item: any, index: any) => {
                if (typeof item === 'string') return item;
                const originalUrl = originalImages.screenshots?.[index];
                return originalUrl
                  ? await replaceImage(originalUrl, item)
                  : await uploadFile(item);
              })
            )
            : originalImages.screenshots &&
              originalImages.screenshots.length > 0
              ? (await Promise.all(
                originalImages.screenshots.map(async (oldUrl) => {
                  await deleteImage(oldUrl);
                  return null;
                })
              ),
                [])
              : [],
      };


      form.setValue('logoFile', uploadedFiles.logoFileUrl);
      form.setValue('coverFile', uploadedFiles.coverFileUrl);
      form.setValue('screenshots', uploadedFiles.screenshotsUrls);
      setOriginalImages({
        logoFile: uploadedFiles.logoFileUrl ?? undefined,
        coverFile: uploadedFiles.coverFileUrl ?? undefined,
        screenshots: uploadedFiles.screenshotsUrls,
      });


      const finalData = {
        ...data,
        logo_url: uploadedFiles.logoFileUrl ?? '',
        cover_url: uploadedFiles.coverFileUrl ?? '',
        screenshots: uploadedFiles.screenshotsUrls,
        github_repository: data.github_repository?.join(',') ?? "",
        demo_link: data.demo_link?.join(',') ?? "",
        categories: data.categories?.join(',') ?? "",
        is_winner: false,
        ...(state.hackathonId && { hackaton_id: state.hackathonId }),
        user_id: session?.user?.id,
      };
      const success = await actions.saveProject(finalData);
      return success;
    } catch (error: any) {
      console.error('Error in saveProject:', error);
      toast({
        title: 'Error saving project',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [
    canSubmit,
    originalImages,
    replaceImage,
    uploadFile,
    deleteImage,
    form,
    actions,
    state.hackathonId,
    session?.user?.id,
    state.id,
    toast
  ]);


  const handleSaveWithoutRoute = useCallback(async (): Promise<void> => {
    try {
      const currentValues = form.getValues();
      const saveData = { ...currentValues, isDraft: true };
      await saveProject(saveData);

      toast({
        title: 'Project saved',
        description: 'Your project has been saved successfully.',
      });
      
      // Redirect to profile projects section if no hackathon
      if (!state.hackathonId) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        router.push('/profile#projects');
      }
    } catch (error) {
      console.error('Error in handleSaveWithoutRoute:', error);
      throw error;
    }
  }, [form, saveProject, toast, router, state.hackathonId]);


  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await handleSaveWithoutRoute();
      if (state.hackathonId) {
        toast({
          title: 'Project saved',
          description: 'Your project has been successfully saved. You will be redirected to the hackathon page.',
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        router.push(`/hackathons/${state.hackathonId}`);
      } else {
        toast({
          title: 'Project saved',
          description: 'Your project has been successfully saved. You will be redirected to your profile.',
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        router.push('/profile#projects');
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while saving the project.',
        variant: 'destructive',
      });
    }
  }, [handleSaveWithoutRoute, toast, router, state.hackathonId]);


  const setFormData = useCallback((project: any) => {
    if (!project || !state.isEditing) return;

    setOriginalImages({
      logoFile: project.logo_url ?? undefined,
      coverFile: project.cover_url ?? undefined,
      screenshots: project.screenshots ?? [],
    });

    form.reset({
      project_name: project.project_name ?? '',
      short_description: project.short_description ?? '',
      full_description: project.full_description ?? '',
      tech_stack: project.tech_stack ?? '',
      github_repository: project.github_repository ? project.github_repository.split(',').filter(Boolean) : [],
      explanation: project.explanation ?? '',
      demo_link: project.demo_link ? project.demo_link.split(',').filter(Boolean) : [],
      is_preexisting_idea: !!project.is_preexisting_idea,
      demo_video_link: project.demo_video_link ?? '',
      tracks: project.tracks ?? (typeof project.tracks === 'string' ? project.tracks.split(',').filter(Boolean) : []),
      categories: Array.isArray(project.categories) 
        ? project.categories 
        : (project.categories ? project.categories.split(',').filter(Boolean) : []),
      other_category: project.other_category ?? '',
      logoFile: project.logo_url ?? undefined,
      coverFile: project.cover_url ?? undefined,
      screenshots: project.screenshots ?? [],
    });
  }, [form, state.isEditing]);


  const resetForm = useCallback(() => {
    form.reset();
    setOriginalImages({});
    actions.resetProject();
  }, [form, actions]);


  return {
    form,
    projectId: state.id,
    hackathonId: state.hackathonId,
    isEditing: state.isEditing,
    canSubmit,
    status: state.status,
    error: state.error,
    originalImages,
    saveProject,
    handleSave,
    handleSaveWithoutRoute,
    setFormData,
    resetForm,
    uploadFile,
    replaceImage,
    deleteImage,
  };
}; 