"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useProjectSubmission } from "../context/ProjectSubmissionContext";
import { useRouter } from "next/navigation";
export const FormSchema = z.object({
  project_name: z.string().min(1, { message: "Project name is required" }),
  short_description: z.string().min(1, { message: "Short description is required" }),
  full_description: z.string().optional(),
  tech_stack: z.string().optional(),
  github_repository: z.preprocess((val) => {
    if (!val) return [];
    if (typeof val === "string") return [];
    return val;
  }, z.array(z.string()).optional()),
  explanation: z.string().optional(),
  demo_link: z.preprocess((val) => {
    if (!val) return [];
    if (typeof val === "string") return [];
    return val;
  }, z.array(z.string()).optional()),
  is_preexisting_idea: z.boolean().optional(),
  logoFile: z.any().optional(),
  coverFile: z.any().optional(),
  screenshots: z.any().optional(),
  demo_video_link: z.string().optional(),
  tracks: z.array(z.string()).min(1, { message: "Please select at least one track" }),
  logo_url: z.string().optional(),
  cover_url: z.string().optional(),
  hackaton_id: z.string().optional(),
  user_id: z.string().optional(),
  is_winner: z.boolean().optional(),
  isDraft: z.boolean().optional(),
});

export type SubmissionForm = z.infer<typeof FormSchema>;
export const Step1Schema = FormSchema.pick({
  project_name: true,
  short_description: true,
  full_description: true,
  tracks: true,
});

export const Step2Schema = FormSchema.pick({
  tech_stack: true,
  github_repository: true,
  explanation: true,
  demo_link: true,
  is_preexisting_idea: true,
});
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
    resolver: zodResolver(FormSchema, undefined, { mode: "async" }),
    reValidateMode: "onChange",
    mode: "onSubmit",
    defaultValues: {
      project_name: "",
      short_description: "",
      full_description: "",
      tech_stack: "",
      tracks: [],
      is_preexisting_idea: false,
      github_repository: [],
      demo_link: [],
      explanation: "",
      demo_video_link: "",
    },
  });

  const canSubmit = state.isEditing && state.hackathonId;

  useEffect(() => {
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

    const subscription = form.watch((value, { name, type }) => {
      if (type === "change" && name) {
        const fieldName = name as keyof SubmissionForm;
        if (form.formState.errors[fieldName]) {
          const allFields = [...step1Fields, ...step2Fields];

          if (allFields.includes(fieldName)) {
            if (timersRef.current[fieldName]) {
              clearTimeout(timersRef.current[fieldName]);
            }

            timersRef.current[fieldName] = setTimeout(() => {
              const schema = FormSchema.pick({
                [fieldName]: true,
              });

              schema.safeParseAsync(form.getValues()).then((result) => {
                if (result.success) {
                  form.clearErrors(fieldName);
                } else {
                  const fieldError = result.error.issues.find(
                    (issue) => issue.path[0] === fieldName
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

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      if (!state.hackathonId) {
        throw new Error("No hackathon selected");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("hackaton_id", state.hackathonId);
      formData.append("user_id", session?.user?.id || "");

      try {
        const response = await axios.post("/api/file", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        return response.data.url;
      } catch (error: any) {
        const message = error.response?.data?.error || error.message || "Error uploading file";
        toast({
          title: "Error uploading file",
          description: message,
          variant: "destructive",
        });
        throw new Error(message);
      }
    },
    [state.hackathonId, session?.user?.id, toast]
  );

  const replaceImage = useCallback(
    async (oldImageUrl: string, newFile: File): Promise<string> => {
      if (!state.hackathonId) {
        throw new Error("No hackathon selected");
      }

      const fileName = oldImageUrl.split("/").pop();
      if (!fileName) throw new Error("Invalid old image URL");

      try {
        await axios.delete("/api/file", {
          params: {
            fileName,
            hackaton_id: state.hackathonId,
            user_id: session?.user?.id,
          },
        });
        const newUrl = await uploadFile(newFile);

        toast({
          title: "Image replaced",
          description: "The image has been replaced successfully.",
        });
        return newUrl;
      } catch (error: any) {
        const message = error.response?.data?.error || error.message || "Error replacing image";
        toast({
          title: "Error replacing image",
          description: message,
          variant: "destructive",
        });
        throw new Error(message);
      }
    },
    [state.hackathonId, session?.user?.id, uploadFile, toast]
  );

  const deleteImage = useCallback(
    async (oldImageUrl: string): Promise<void> => {
      if (!state.hackathonId) {
        throw new Error("No hackathon selected");
      }

      const fileName = oldImageUrl.split("/").pop();
      if (!fileName) throw new Error("Invalid old image URL");

      try {
        await fetch(
          `/api/file?fileName=${encodeURIComponent(fileName)}&hackathon_id=${state.hackathonId}&user_id=${session?.user?.id}`,
          {
            method: "DELETE",
          }
        );

        toast({
          title: "Image deleted",
          description: "The image has been deleted successfully.",
        });
      } catch (error: any) {
        const message = error.response?.data?.error || error.message || "Error deleting image";
        toast({
          title: "Error deleting image",
          description: message,
          variant: "destructive",
        });
        throw new Error(message);
      }
    },
    [state.hackathonId, session?.user?.id, toast]
  );

  const saveProject = useCallback(
    async (data: SubmissionForm): Promise<boolean> => {
      try {
        if (!canSubmit) {
          throw new Error("Project is not ready for submission");
        }

        const uploadedFiles = {
          logoFileUrl:
            data.logoFile && (!Array.isArray(data.logoFile) || data.logoFile.length > 0)
              ? typeof data.logoFile === "string"
                ? data.logoFile
                : originalImages.logoFile
                  ? await replaceImage(originalImages.logoFile, data.logoFile)
                  : await uploadFile(data.logoFile)
              : originalImages.logoFile
                ? (await deleteImage(originalImages.logoFile), null)
                : null,

          coverFileUrl:
            data.coverFile && (!Array.isArray(data.coverFile) || data.logoFile.length > 0)
              ? typeof data.coverFile === "string"
                ? data.coverFile
                : originalImages.coverFile
                  ? await replaceImage(originalImages.coverFile, data.coverFile)
                  : await uploadFile(data.coverFile)
              : originalImages.coverFile
                ? (await deleteImage(originalImages.coverFile), null)
                : null,

          screenshotsUrls:
            data.screenshots && Array.isArray(data.screenshots) && data.screenshots.length > 0
              ? await Promise.all(
                  data.screenshots.map((item: any, index: any) => {
                    if (typeof item === "string") return Promise.resolve(item);
                    const originalUrl = originalImages.screenshots?.[index];
                    return originalUrl ? replaceImage(originalUrl, item) : uploadFile(item);
                  })
                )
              : originalImages.screenshots && originalImages.screenshots.length > 0
                ? (await Promise.all(
                    originalImages.screenshots.map(async (oldUrl) => {
                      await deleteImage(oldUrl);
                      return null;
                    })
                  ),
                  [])
                : [],
        };

        form.setValue("logoFile", uploadedFiles.logoFileUrl);
        form.setValue("coverFile", uploadedFiles.coverFileUrl);
        form.setValue("screenshots", uploadedFiles.screenshotsUrls);
        setOriginalImages({
          logoFile: uploadedFiles.logoFileUrl ?? undefined,
          coverFile: uploadedFiles.coverFileUrl ?? undefined,
          screenshots: uploadedFiles.screenshotsUrls,
        });

        const finalData = {
          ...data,
          logo_url: uploadedFiles.logoFileUrl ?? "",
          cover_url: uploadedFiles.coverFileUrl ?? "",
          screenshots: uploadedFiles.screenshotsUrls,
          github_repository: data.github_repository?.join(",") ?? "",
          demo_link: data.demo_link?.join(",") ?? "",
          is_winner: false,
          hackaton_id: state.hackathonId,
          user_id: session?.user?.id,
        };
        const success = await actions.saveProject(finalData);
        return success;
      } catch (error: any) {
        console.error("Error in saveProject:", error);
        toast({
          title: "Error saving project",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    },
    [
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
      toast,
    ]
  );

  const handleSaveWithoutRoute = useCallback(async (): Promise<void> => {
    try {
      const currentValues = form.getValues();
      const saveData = { ...currentValues, isDraft: true };
      await saveProject(saveData);

      toast({
        title: "Project saved",
        description: "Your project has been saved successfully.",
      });
    } catch (error) {
      console.error("Error in handleSaveWithoutRoute:", error);
      throw error;
    }
  }, [form, saveProject, toast]);

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await handleSaveWithoutRoute();
      toast({
        title: "Project saved",
        description:
          "Your project has been successfully saved. You will be redirected to the hackathon page.",
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      router.push(`/hackathons/${state.hackathonId}`);
    } catch (error) {
      console.error("Error in handleSave:", error);
      toast({
        title: "Error",
        description: "An error occurred while saving the project.",
        variant: "destructive",
      });
    }
  }, [handleSaveWithoutRoute, toast, router, state.hackathonId]);

  const setFormData = useCallback(
    (project: any) => {
      if (!project || !state.isEditing) return;

      setOriginalImages({
        logoFile: project.logo_url ?? undefined,
        coverFile: project.cover_url ?? undefined,
        screenshots: project.screenshots ?? [],
      });

      form.reset({
        project_name: project.project_name ?? "",
        short_description: project.short_description ?? "",
        full_description: project.full_description ?? "",
        tech_stack: project.tech_stack ?? "",
        github_repository: project.github_repository
          ? project.github_repository.split(",").filter(Boolean)
          : [],
        explanation: project.explanation ?? "",
        demo_link: project.demo_link ? project.demo_link.split(",").filter(Boolean) : [],
        is_preexisting_idea: !!project.is_preexisting_idea,
        demo_video_link: project.demo_video_link ?? "",
        tracks: project.tracks ?? [],
        logoFile: project.logo_url ?? undefined,
        coverFile: project.cover_url ?? undefined,
        screenshots: project.screenshots ?? [],
      });
    },
    [form, state.isEditing]
  );

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
