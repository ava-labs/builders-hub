import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useProjectSubmission } from '../context/ProjectSubmissionContext';

// Definir el schema y tipos localmente para evitar problemas de importación
export const FormSchema = z.object({
  project_name: z.string().min(2).max(60),
  short_description: z.string().min(30).max(280),
  full_description: z.string().min(30),
  tech_stack: z.string().min(30),
  github_repository: z.array(z.string()).min(1),
  explanation: z.string().optional(),
  demo_link: z.array(z.string()).min(1),
  is_preexisting_idea: z.boolean(),
  demo_video_link: z.string().optional(),
  tracks: z.array(z.string()).min(1),
  logoFile: z.any().optional(),
  coverFile: z.any().optional(),
  screenshots: z.array(z.any()).optional(),
});

export type SubmissionForm = z.infer<typeof FormSchema>;

export const useSubmissionFormSecure = () => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { state, actions } = useProjectSubmission();
  
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

  // Solo verificar que el proyecto esté inicializado
  const canSubmit = state.isEditing && state.hackathonId;

  // Funciones de carga de archivos con validación básica
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!state.hackathonId) {
      throw new Error('No hackathon selected');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('hackathon_id', state.hackathonId);
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
          hackathon_id: state.hackathonId,
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

  // Función de guardado simplificada que usa el contexto
  const saveProject = useCallback(async (data: SubmissionForm): Promise<boolean> => {
    try {
      // Validar estado básico antes de proceder
      if (!canSubmit) {
        throw new Error('Project is not ready for submission');
      }

      // Manejar carga de archivos
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

      // Actualizar formulario con URLs de archivos cargados
      form.setValue('logoFile', uploadedFiles.logoFileUrl);
      form.setValue('coverFile', uploadedFiles.coverFileUrl);
      form.setValue('screenshots', uploadedFiles.screenshotsUrls);

      // Actualizar estado de imágenes originales
      setOriginalImages({
        logoFile: uploadedFiles.logoFileUrl ?? undefined,
        coverFile: uploadedFiles.coverFileUrl ?? undefined,
        screenshots: uploadedFiles.screenshotsUrls,
      });

      // Preparar datos finales
      const finalData = {
        ...data,
        logo_url: uploadedFiles.logoFileUrl ?? '',
        cover_url: uploadedFiles.coverFileUrl ?? '',
        screenshots: uploadedFiles.screenshotsUrls,
        github_repository: data.github_repository?.join(',') ?? "",
        demo_link: data.demo_link?.join(',') ?? "",
        is_winner: false,
      };

      // Usar contexto para guardar proyecto
      const success = await actions.saveProject(finalData);
      
      // No necesitamos actualizar el formulario con un ID que no existe en el schema
      // El contexto ya maneja el projectId internamente

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
    state.id,
    toast
  ]);

  // Guardar sin navegación
  const handleSaveWithoutRoute = useCallback(async (): Promise<void> => {
    try {
      const currentValues = form.getValues();
      const saveData = { ...currentValues, isDraft: true };
      await saveProject(saveData);
    } catch (error) {
      console.error('Error in handleSaveWithoutRoute:', error);
      throw error;
    }
  }, [form, saveProject]);

  // Guardar con navegación
  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await handleSaveWithoutRoute();
      toast({
        title: 'Project saved',
        description: 'Your project has been successfully saved.',
      });
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while saving the project.',
        variant: 'destructive',
      });
    }
  }, [handleSaveWithoutRoute, toast]);

  // Establecer datos del formulario desde proyecto existente
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

  // Resetear formulario y contexto
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