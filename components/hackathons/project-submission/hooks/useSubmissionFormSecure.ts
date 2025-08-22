import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useProjectSubmission } from '../context/ProjectSubmissionContext';
import { useRouter } from 'next/navigation';
export const FormSchema = z
  .object({
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
      z.array(
        z.string()
          .min(1, { message: 'Repository link is required' })
      )
      .min(1, { message: 'At least one link is required' })
      .refine(
        (links) => {
          const uniqueLinks = new Set(links);
          return uniqueLinks.size === links.length;
        },
        { message: 'Duplicate repository links are not allowed' }
      )
      .transform((val) => {
        const invalidLinks = val.filter(link => {
          if (link.startsWith('http')) {
            try {
              new URL(link);
              return false; // URL válida
            } catch {
              return true; // URL inválida
            }
          }
          
          // Si no es una URL, verificar que tenga formato válido (opcional)
          return link.trim().length === 0;
        });
        
        if (invalidLinks.length > 0) {
          throw new z.ZodError([
            {
              code: 'custom',
              message: 'Please enter valid  links (URLs or other formats)',
              path: ['github_repository']
            }
          ]);
        }
        return val;
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
    tracks: z.array(z.string()).min(1, 'track are required'),
    logo_url: z.string().optional(),
    cover_url: z.string().optional(),
    hackaton_id: z.string().optional(),
    user_id: z.string().optional(),
    is_winner: z.boolean().optional(),
    isDraft: z.boolean().optional(),
  })
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
  );

export type SubmissionForm = z.infer<typeof FormSchema>;

export const useSubmissionFormSecure = () => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { state, actions } = useProjectSubmission();
  const router = useRouter();
  
  const [originalImages, setOriginalImages] = useState<{
    logoFile?: string;
    coverFile?: string;
    screenshots?: string[];
  }>({});

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      project_name: '',
      short_description: '',
      full_description: '',
      tracks: [],
      is_preexisting_idea: false,
      github_repository: [],
      demo_link: [],
    },
  });

  const canSubmit = state.isEditing && state.hackathonId;
 
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change' && name) {
        form.trigger(name as keyof SubmissionForm);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!state.hackathonId) {
      throw new Error('No hackathon selected');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('hackaton_id', state.hackathonId);
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
    if (!state.hackathonId) {
      throw new Error('No hackathon selected');
    }

    const fileName = oldImageUrl.split('/').pop();
    if (!fileName) throw new Error('Invalid old image URL');

    try {
      await axios.delete('/api/file', { 
        params: { 
          fileName,
          hackaton_id: state.hackathonId,
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
    if (!state.hackathonId) {
      throw new Error('No hackathon selected');
    }

    const fileName = oldImageUrl.split('/').pop();
    if (!fileName) throw new Error('Invalid old image URL');

    try {
      await fetch(`/api/file?fileName=${encodeURIComponent(fileName)}&hackathon_id=${state.hackathonId}&user_id=${session?.user?.id}`, {
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
          (!Array.isArray(data.coverFile) || data.logoFile.length > 0)
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
        is_winner: false,
        hackaton_id: state.hackathonId,
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
    } catch (error) {
      console.error('Error in handleSaveWithoutRoute:', error);
      throw error;
    }
  }, [form, saveProject, toast]); 


  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await handleSaveWithoutRoute();
      toast({
        title: 'Project saved',
        description: 'Your project has been successfully saved. You will be redirected to the hackathon page.',
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      router.push(`/hackathons/${state.hackathonId}`);
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
      tracks: project.tracks ?? [],
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