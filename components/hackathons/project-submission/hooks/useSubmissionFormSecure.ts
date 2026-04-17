'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zodResolver';
import { z } from 'zod';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useProjectSubmission } from '../context/ProjectSubmissionContext';
import { useRouter } from 'next/navigation';
import { isValidHttpUrl, normalizeUrl } from '@/lib/url-validation';

type KeyValueItem = { key: string; value: string };

/** Converts any raw input into a normalized KeyValueItem[], dropping entries with empty value. */
const toKeyValueItems = (val: unknown): KeyValueItem[] => {
  const build = (key: unknown, value: unknown): KeyValueItem => ({
    key: String(key ?? ''),
    value: String(value ?? ''),
  });

  let items: KeyValueItem[] = [];

  if (!val) {
    items = [];
  } else if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        items = Object.entries(parsed as Record<string, unknown>).map(([k, v]) => build(k, v));
      }
    } catch {
      const trimmed = val.trim();
      if (trimmed) items = [build('url', trimmed)];
    }
  } else if (Array.isArray(val)) {
    items = val.map((item: unknown) =>
      typeof item === 'object' && item !== null && 'key' in item && 'value' in item
        ? build((item as KeyValueItem).key, (item as KeyValueItem).value)
        : build('', '')
    );
  } else if (typeof val === 'object' && val !== null) {
    items = Object.entries(val as Record<string, unknown>).map(([k, v]) => build(k, v));
  }

  return items
    .filter((item) => item.value && item.value.trim().length > 0)
    .map((item) => ({ key: item.key.trim(), value: normalizeUrl(item.value) }));
};

/** Shared schema for website/socials: { key, value }[] where value must be a valid URL. */
const urlKeyValueArraySchema = z
  .array(z.object({ key: z.string(), value: z.string() }))
  .default([])
  .superRefine((arr, ctx) => {
    arr.forEach((item, idx) => {
      if (!isValidHttpUrl(item.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Entry ${idx + 1}: please enter a valid URL (e.g. https://example.com)`,
          path: [],
        });
      }
    });
  });

/** Normalizes a raw array of link strings: trims, drops empties, prepends https:// when missing. */
const normalizeLinkArray = (val: unknown): string[] => {
  if (!val) return [];
  if (!Array.isArray(val)) return [];
  return val
    .filter((link): link is string => typeof link === 'string')
    .map((link) => normalizeUrl(link))
    .filter((link) => link.length > 0);
};

/** Builds a schema for an array of URL strings with duplicate and validity checks. */
const buildUrlArraySchema = (options: { duplicateMessage: string; invalidMessage: string }) =>
  z
    .array(z.string())
    .optional()
    .default([])
    .refine((links) => new Set(links).size === links.length, {
      message: options.duplicateMessage,
    })
    .superRefine((links, ctx) => {
      const hasInvalid = links.some((link) => !isValidHttpUrl(link));
      if (hasInvalid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: options.invalidMessage,
          path: [],
        });
      }
    });

// Base schema without refinements - needed for .pick() to work
const BaseFormSchema = z.object({
  project_name: z
    .string()
    .min(1, { message: 'Project Name is required' })
    .max(60, { message: 'Max 60 characters allowed' }),
  short_description: z
    .string()
    .max(280, { message: 'Max 280 characters allowed' })
    .optional()
    .or(z.literal('')),
  full_description: z
    .string()
    .optional()
    .or(z.literal('')),
  tech_stack: z
    .string()
    .optional()
    .or(z.literal('')),
  github_repository: z.preprocess(
    normalizeLinkArray,
    buildUrlArraySchema({
      duplicateMessage: 'Duplicate repository links are not allowed',
      invalidMessage: 'Please enter valid repository links (e.g. https://github.com/user/repo)',
    })
  ),
  explanation: z.string().optional(),
  demo_link: z.preprocess(
    normalizeLinkArray,
    buildUrlArraySchema({
      duplicateMessage: 'Duplicate demo links are not allowed',
      invalidMessage: 'Please enter a valid URL (e.g. https://example.com)',
    })
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
  deployed_addresses: z.array(z.object({
    address: z.string().min(1, { message: 'Address is required' }),
    tag: z.string().optional(),
  }))
    .optional()
    .default([])
    .transform((arr) => {
      // Si el array está vacío o es undefined, retornar array vacío (campo opcional)
      if (!arr || arr.length === 0) {
        return [];
      }
      // Filtrar entradas donde address esté vacío o tag esté vacío (si existe)
      const filtered = arr.filter((item) => {
        const hasValidAddress = item.address && item.address.trim().length > 0;
        const hasValidTag = !item.tag || item.tag.trim().length > 0;
        // Solo guardar si tiene address válido Y (no tiene tag o tiene tag válido)
        return hasValidAddress && hasValidTag;
      });
      // Retornar array vacío si todas las entradas fueron filtradas (campo opcional)
      return filtered;
    }),
  website: z.preprocess(toKeyValueItems, urlKeyValueArraySchema),
  socials: z.preprocess(toKeyValueItems, urlKeyValueArraySchema),
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
  deployed_addresses: true,
  website: true,
  socials: true,
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
    if (!data.other_category || data.other_category.trim().length < 1) {
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
      return data.explanation && data.explanation.length >= 1;
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
        return data.explanation && data.explanation.length >= 1;
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
        return data.other_category && data.other_category.trim().length >= 1;
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
    mode: 'onTouched',
    defaultValues: {
      project_name: '',
      short_description: '',
      full_description: '',
      tech_stack: '',
      tracks: [],
      categories: [],
      other_category: '',
      deployed_addresses: [],
      website: [],
      socials: [],
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

  const saveProject = useCallback(async (data: SubmissionForm): Promise<{ success: boolean; projectId?: string }> => {
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


      // Filtrar deployed_addresses para eliminar entradas con address o tag vacíos
      const filteredDeployedAddresses = (data.deployed_addresses || []).filter(
        (item: { address: string; tag?: string }) => 
          item.address && 
          item.address.trim().length > 0 &&
          (!item.tag || item.tag.trim().length > 0)
      );

      // Convertir website y socials (array clave-valor) a objeto JSONB
      const keyValueToObject = (arr: Array<{ key: string; value: string }> | undefined) => {
        if (!arr || !Array.isArray(arr)) return null;
        const obj: Record<string, string> = {};
        arr.forEach(({ key, value }) => {
          const k = key?.trim();
          if (k && value != null) obj[k] = String(value).trim();
        });
        return Object.keys(obj).length > 0 ? obj : null;
      };

      const finalData = {
        ...data,
        logo_url: uploadedFiles.logoFileUrl ?? '',
        cover_url: uploadedFiles.coverFileUrl ?? '',
        screenshots: uploadedFiles.screenshotsUrls,
        github_repository: data.github_repository?.join(',') ?? "",
        demo_link: data.demo_link?.join(',') ?? "",
        categories: data.categories?.join(',') ?? "",
        deployed_addresses: filteredDeployedAddresses,
        website: keyValueToObject(data.website),
        socials: keyValueToObject(data.socials),
        is_winner: false,
        ...(state.hackathonId && { hackaton_id: state.hackathonId }),
        user_id: session?.user?.id,
      };
      const result = await actions.saveProject(finalData);
      return result;
    } catch (error: any) {
      console.error('Error in saveProject:', error);
      toast({
        title: 'Error saving project',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false };
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


  const handleSaveWithoutRoute = useCallback(async (): Promise<{ success: boolean; projectId?: string }> => {
    try {
      const currentValues = form.getValues();
      const saveData = { ...currentValues, isDraft: true };
      const result = await saveProject(saveData);

      if (result.success) {
        toast({
          title: 'Project saved',
          description: 'Your project has been saved successfully.',
        });
      }

      return result;
    } catch (error) {
      console.error('Error in handleSaveWithoutRoute:', error);
      return { success: false };
    }
  }, [form, saveProject, toast]);


  const handleSave = useCallback(async (): Promise<void> => {
    console.log('💾 handleSave called for Save & Continue Later');
    try {
      const result = await handleSaveWithoutRoute();
      console.log('💾 handleSave result:', result);

      if (result.success && result.projectId) {
        console.log('💾 handleSave redirecting to profile');
        toast({
          title: 'Project saved',
          description: 'Your project has been saved. Redirecting to your profile...',
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        router.push('/profile?tab=projects');
      }
      // If not successful, error message already shown by handleSaveWithoutRoute
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while saving the project.',
        variant: 'destructive',
      });
    }
  }, [handleSaveWithoutRoute, toast, router]);


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
      deployed_addresses: Array.isArray(project.deployed_addresses) 
        ? project.deployed_addresses 
        : [],
      website: (() => {
        const w = project.website;
        if (!w) return [];
        if (typeof w === 'object' && w !== null && !Array.isArray(w)) {
          return Object.entries(w).map(([key, value]) => ({ key, value: String(value ?? '') }));
        }
        if (typeof w === 'string') {
          try {
            const p = JSON.parse(w);
            if (p && typeof p === 'object' && !Array.isArray(p)) {
              return Object.entries(p).map(([k, v]) => ({ key: k, value: String(v ?? '') }));
            }
          } catch {
            return [];
          }
        }
        return Array.isArray(w) ? w : [];
      })(),
      socials: (() => {
        const s = project.socials;
        if (!s) return [];
        if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
          return Object.entries(s).map(([key, value]) => ({ key, value: String(value ?? '') }));
        }
        if (typeof s === 'string') {
          try {
            const p = JSON.parse(s);
            if (p && typeof p === 'object' && !Array.isArray(p)) {
              return Object.entries(p).map(([k, v]) => ({ key: k, value: String(v ?? '') }));
            }
          } catch {
            return [];
          }
        }
        return Array.isArray(s) ? s : [];
      })(),
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