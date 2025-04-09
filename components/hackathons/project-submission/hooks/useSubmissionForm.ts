import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

export const FormSchema = z.object({
  project_name: z
    .string()
    .min(2, { message: "Project Name must be at least 2 characters" })
    .max(60, { message: "Max 60 characters allowed" }),
  short_description: z
    .string()
    .min(2, { message: "short description must be at least 30 characters" })
    .max(280, { message: "Max 280 characters allowed" }),
  full_description: z.string().min(2, { message: "full description must be at least 30 characters" }),
  tech_stack: z.string().min(2, { message: "tech stack must be at least 30 characters" }),
  github_repository: z.string().min(2, { message: "github repository is required" }),
  explanation: z.string().min(2, { message: "explanation is required" }),
  demo_link: z.string().optional(),
  is_preexisting_idea: z.boolean(),
  logoFile: z.any().optional(),
  coverFile: z.any().optional(),
  screenshots: z.any().optional(),
  demoVideoLink: z.string().optional(),
  tracks: z.array(z.string()).min(1, "track are required"),
});

export type SubmissionForm = z.infer<typeof FormSchema>;

export const useSubmissionForm = (hackathonId: string) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [originalImages, setOriginalImages] = useState<{
    logoFile?: string;
    coverFile?: string;
    screenshots?: string[];
  }>({});
  const [projectId, setProjectId] = useState<string>("");

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      project_name: "",
      short_description: "",
      full_description: "",
      tracks: [],
      is_preexisting_idea: false,
    },
  });

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/upload-file", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data.url;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || "Error uploading file";
      throw new Error(message);
    }
  };

  const replaceImage = async (oldImageUrl: string, newFile: File): Promise<string> => {
    const fileName = oldImageUrl.split("/").pop();
    if (!fileName) throw new Error("Invalid old image URL");

    try {
      await axios.delete("/api/upload-file/delete", { params: { fileName } });
      return await uploadFile(newFile);
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || "Error replacing image";
      throw new Error(message);
    }
  };

  const deleteImage = async (oldImageUrl: string): Promise<void> => {
    const fileName = oldImageUrl.split("/").pop();
    await fetch(`/api/upload-file/delete?fileName=${encodeURIComponent(fileName!)}`, {
      method: "DELETE",
    });
  };

  const saveProject = async (data: SubmissionForm) => {
    try {
      const uploadedFiles = {
        logoFileUrl: data.logoFile && (!Array.isArray(data.logoFile) || data.logoFile.length > 0)
          ? typeof data.logoFile === "string"
            ? data.logoFile
            : originalImages.logoFile
              ? await replaceImage(originalImages.logoFile, data.logoFile)
              : await uploadFile(data.logoFile)
          : originalImages.logoFile
            ? (await deleteImage(originalImages.logoFile), null)
            : null,

        coverFileUrl: data.coverFile && (!Array.isArray(data.coverFile) || data.coverFile.length > 0)
          ? typeof data.coverFile === "string"
            ? data.coverFile
            : originalImages.coverFile
              ? await replaceImage(originalImages.coverFile, data.coverFile)
              : await uploadFile(data.coverFile)
          : originalImages.coverFile
            ? (await deleteImage(originalImages.coverFile), null)
            : null,

        screenshotsUrls: data.screenshots && Array.isArray(data.screenshots) && data.screenshots.length > 0
          ? await Promise.all(
              data.screenshots.map(async (item: any, index: any) => {
                if (typeof item === "string") return item;
                const originalUrl = originalImages.screenshots?.[index];
                return originalUrl ? await replaceImage(originalUrl, item) : await uploadFile(item);
              })
            )
          : originalImages.screenshots && originalImages.screenshots.length > 0
            ? (await Promise.all(
                originalImages.screenshots.map(async (oldUrl) => {
                  await deleteImage(oldUrl);
                  return null;
                })
              ), [])
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
        hackaton_id: hackathonId,
        user_id: session?.user.id ?? "",
        is_winner: false,
        id: projectId,
      };

      const response = await axios.post(`/api/project/`, finalData);
      setProjectId(response.data.id);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const handleSave = async () => {
      await handleSaveWithoutRoute();
      router.push(`/hackathons/${hackathonId}`);
  };

  const handleSaveWithoutRoute= async () => {
    try {
      const currentValues = form.getValues();
      const savePrev = {...currentValues,isDraft:true}
      await saveProject(savePrev);

    } catch (error) {
      console.error("Error in handleSave:", error);
    }
  };

  const setFormData = (project: any) => {
    setOriginalImages({
      logoFile: project.logo_url ?? undefined,
      coverFile: project.cover_url ?? undefined,
      screenshots: project.screenshots ?? [],
    });
    form.reset({
      project_name: project.project_name,
      short_description: project.short_description,
      full_description: project.full_description,
      tech_stack: project.tech_stack,
      github_repository: project.github_repository,
      explanation: project.explanation,
      demo_link: project.demo_link,
      is_preexisting_idea: project.is_preexisting_idea,
      demoVideoLink: project.demo_video_link,
      tracks: project.tracks,
      logoFile: project.logo_url ?? undefined,
      coverFile: project.cover_url ?? undefined,
      screenshots: project.screenshots ?? [],
    });
    setProjectId(project.id);
  };

  return {
    form,
    projectId,
    originalImages,
    saveProject,
    handleSave,
    setFormData,
    setProjectId,
    handleSaveWithoutRoute
  };
}; 