"use client";

import React, { useEffect, useState } from "react";
import { useCountdown } from "./Count-down";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Hourglass, Pickaxe, Tag, Users, Image } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { zodResolver } from "@hookform/resolvers/zod";
import { string, z } from "zod";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import SubmitStep1 from "./SubmissionStep1";
import SubmitStep2 from "./SubmissionStep2";
import SubmitStep3 from "./SubmissionStep3";
import { Separator } from "@/components/ui/separator";
import axios from "axios";
import { HackathonHeader } from "@/types/hackathons";
import { Project } from "@/types/project";
import { useSession } from "next-auth/react";
import { User } from "next-auth";

export const FormSchema = z.object({
  project_name: z
    .string()
    .min(2, { message: "Project Name must be at least 2 characters" })
    .max(60, { message: "Max 60 characters allowed" }),
  short_description: z.string().max(280, { message: "Max 280 characters allowed" }),
  full_description: z.string().optional(),
  tech_stack: z.string().optional(),
  github_repository: z.string().optional(),
  explanation: z.string().optional(),
  demo_link: z.string().optional(),
  is_preexisting_idea: z.boolean(),
  logoFile: z.any().optional(),
  coverFile: z.any().optional(),
  screenshots: z.any().optional(),
  demoVideoLink: z.string().optional(),
  tracks: z.array(z.string()).min(1, "track are required"),
});

export type SubmissionForm = z.infer<typeof FormSchema>;

export default function GeneralComponent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [hackathon, setHackathon] = useState<HackathonHeader | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [formData, setFormData] = useState({});
  const [step, setStep] = useState(1);
  const [deadline, setDeadline] = useState<number>(
    new Date().getTime() + 12 * 60 * 60 * 1000 // 12h de cuenta regresiva
  );
  const { data: session, status } = useSession();
  const currentUser: User | undefined = session?.user;
  const timeLeft: string = useCountdown(deadline);
  const [originalImages, setOriginalImages] = useState<{
    logoFile?: string;
    coverFile?: string;
    screenshots?: string[];
  }>({});
  let hackathon_id = searchParams?.hackaId ?? "";

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      project_name: "",
      short_description: "",
      full_description: "",
      tracks: [],
      is_preexisting_idea: false, // Añadimos un valor por defecto para open_source
    },
  });

  const handleStepChange = (newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
      setStep(newStep);
      if (newStep === 2) setProgress(70);
      if (newStep === 3) setProgress(100);
      if (newStep === 1) setProgress(40);
    }
  };

  async function getHackathon() {
    if (!hackathon_id) return;
    try {
      const response = await axios.get(`/api/hackathons/${hackathon_id}`);
      setHackathon(response.data);
      let deadlineValue = 0;
      if (response.data?.content?.submission_deadline) {
        deadlineValue = new Date(response.data.content.submission_deadline).getTime();
      } else {
 
      }
      setDeadline(deadlineValue);
    } catch (err) {
      console.error("API Error:", err);
    }
  }

  async function getProject(){
    try {
      const response = await axios.get(`/api/project`, {
        params: {
          hackathon_id,
          user_id: session?.user.id,
        },
      });
      if (response.data.project) {
        setData(response.data.project)
      }
  }
  catch (err) {
    console.error("Error fetching project:", err);
  }

}
  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    console.log("show:",file)
    const response = await fetch("/api/upload-file", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Error uploading file");
    }

    return data.url;
  }

  async function replaceImage(oldImageUrl: string, newFile: File): Promise<string> {
    const fileName = oldImageUrl.split('/').pop();
    await fetch(`/api/upload-file/delete?fileName=${encodeURIComponent(fileName!)}`, {
      method: 'DELETE',
    });

    return await uploadFile(newFile);
  }

  async function saveProject(data: Project) {
    try {
      const response = await axios.post(`/api/project/`, data);
      console.log("Project saved successfully:", response.data);
    } catch (err) {
      console.error("API Error in saveProject:", err);
      throw err; // Relanzamos el error para que se maneje en el llamador
    }
  }

  const save = async (data: SubmissionForm) => {
    try {
      const uploadedFiles = {
        logoFileUrl: data.logoFile 
          ? typeof data.logoFile === "string" 
            ? data.logoFile 
            : originalImages.logoFile 
              ? await replaceImage(originalImages.logoFile, data.logoFile) 
              : await uploadFile(data.logoFile)
          : null,

        coverFileUrl: data.coverFile 
          ? typeof data.coverFile === "string" 
            ? data.coverFile 
            : originalImages.coverFile 
              ? await replaceImage(originalImages.coverFile, data.coverFile)
              : await uploadFile(data.coverFile)
          : null,
  

        screenshotsUrls: data.screenshots
          ? await Promise.all(
              data.screenshots.map(async (item:any, index:any) => {
                if (typeof item === "string") {
                  return item;
                } else {
                  const originalUrl = originalImages.screenshots?.[index];
                  return originalUrl 
                    ? await replaceImage(originalUrl, item)
                    : await uploadFile(item);
                }
              })
            )
          : [],
      };

      setFormData((prevData) => ({ ...prevData, ...data }));

      const finalData: Project = {
        ...data,
        logo_url: uploadedFiles.logoFileUrl ?? "",
        cover_url: uploadedFiles.coverFileUrl ?? "",
        screenshots: uploadedFiles.screenshotsUrls,
        hackaton_id: hackathon_id as string,
        user_id : session?.user.id??"",
        id: "", 
      };
      console.log("session",session)
      await saveProject(finalData); 
    } catch (error) {
      console.error("Error in save:", error);
      throw error; 
    }
  };

  const handleSave = async () => {
    try {
      await form.handleSubmit(save)(); // Ejecuta la validación y luego save
      console.log("Save & Continue Later completed successfully");
    } catch (error) {
      console.error("Error in handleSave:", error);
    }
  };

  const onSubmit = async (data: SubmissionForm) => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      try {
        await save(data); // Guardamos cuando se completa el formulario
      } catch (error) {
        console.error("Error uploading files or saving project:", error);
      }
    }
  };

 function setData(project:any){
  setOriginalImages({
    logoFile: project.logo_url??undefined,
    coverFile: project.cover_url??undefined,
    screenshots: project.screenshots??[],
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

  }
  useEffect(() => {
    getHackathon();
  }, [hackathon_id]);
  useEffect(() => {
    if (hackathon_id && session?.user?.id) {
      getProject();
    }
  }, [hackathon_id, session?.user?.id]);
  return (
    <div className="p-6 rounded-lg">
      {/* Encabezado */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Submit Your Project</h2>
        <p className="text-gray-400 text-sm">
          Finalize and submit your project for review before the deadline.
          Complete all sections to ensure eligibility.
        </p>
      </div>

      {/* Contenedor de progreso y deadline */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Progress
            value={progress}
            className="rounded-full h-4 w-[294px] md:w-[430px]"
          />
          <span className="text-sm">
            {progress}% Complete - Finish your submission!
          </span>
        </div>

        <Badge
          variant="outline"
          className="flex items-center gap-2 border-red-500 px-3 py-1"
        >
          <Hourglass size={16} color="#F5F5F9" />
          <span>Deadline: {timeLeft} remaining</span>
        </Badge>
      </div>

      {/* Contenedor principal */}
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && <SubmitStep1 />}
                {step === 2 && <SubmitStep2 />}
                {step === 3 && <SubmitStep3 />}
                <Separator />
                <div className="flex flex-col md:flex-row items-center justify-between mt-8">
                  <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
                    <Button type="submit" variant="red" className="px-4 py-2">
                      Continue
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSave}
                      variant="secondary"
                      className="dark:bg-white dark:text-black px-4 py-2"
                    >
                      Save & Continue Later
                    </Button>
                  </div>

                  <div className="flex flex-col md:flex-row items-center">
                    <div className="flex items-center space-x-1">
                      {step > 1 && (
                        <PaginationPrevious
                          className="dark:hover:text-gray-200 cursor-pointer"
                          onClick={() => setStep(step - 1)}
                        />
                      )}
                      <Pagination>
                        <PaginationContent>
                          {Array.from({ length: 3 }, (_, i) => i + 1).map(
                            (page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  isActive={step === page}
                                  className="cursor-pointer"
                                  onClick={() => handleStepChange(page)}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}
                        </PaginationContent>
                      </Pagination>
                      {step < 3 && (
                        <PaginationNext
                          className="dark:hover:text-gray-200 cursor-pointer"
                          onClick={form.handleSubmit(onSubmit)}
                        />
                      )}
                    </div>
                    <div className="mt-2 md:mt-0 md:ml-4">
                      <span className="font-Aeonik text-xs sm:text-sm">
                        Step {step} of 3
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          </section>
        </div>
      </div>
    </div>
  );
}