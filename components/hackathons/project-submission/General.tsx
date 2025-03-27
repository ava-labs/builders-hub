"use client";

import React, { useState } from "react";
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
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import SubmitStep1 from "./SubmissionStep1";
import SubmitStep2 from "./SubmissionStep2";
import SubmitStep3 from "./SubmissionStep3";
import { File } from 'fumadocs-ui/components/files';
import { Separator } from "@/components/ui/separator";

export const FormSchema = z.object({
  projectName: z
    .string()
    .min(2, { message: "Project Name must be at least 2 characters" })
    .max(60, { message: "Max 60 characters allowed" }),
  shortDescription: z
    .string()
    .max(280, { message: "Max 280 characters allowed" }),
  fullDescription: z.string().optional(),
  tech: z.string().optional(),
  how_made_it: z.string().optional(),
  github_repository: z.string().optional(),
  demo_link: z.string().optional(),
  logoFile: z.any().optional(),
  coverFile: z.any().optional(),
  screenshots: z.any().optional(),
  demoVideoLink: z.string().optional(),
  track: z
  .array(z.enum(["tech", "design", "business"]))
  .nonempty({ message: "Please select at least one track" }),
});

export type SubmissionForm = z.infer<typeof FormSchema>;

export default function GeneralComponent() {
  const [progress, setProgress] = useState<number>(40);
  const [formData, setFormData] = useState({});
  const [step, setStep] = useState(1);
  const [deadline, setDeadline] = useState<number>(
    new Date().getTime() + 12 * 60 * 60 * 1000 // 12h de cuenta regresiva
  );
  const timeLeft: string = useCountdown(deadline);

  const form = useForm<SubmissionForm>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      projectName: "",
      shortDescription: "",
      fullDescription: "",
      track: [],
    },
  });
  const handleStepChange = (newStep: number) => {
    if (newStep >= 1 && newStep <= 3) {
      setStep(newStep);
    }
  };
  const onNextStep = async () => {
    let fieldsToValidate: (keyof SubmissionForm)[] = [];
    // if (step === 1) {
    //   fieldsToValidate = [
    //     "name",
    //     "email",
    //     "company_name",
    //     "dietary",
    //     "role",
    //     "city",
    //   ];
    // } else if (step === 2) {
    //   fieldsToValidate = [
    //     "web3_proficiency",
    //     "tools",
    //     "roles",
    //     "languages",
    //     "interests",
    //     "hackathon_participation",
    //     "github_portfolio",
    //   ];
    // } else if (step === 3) {
    //   fieldsToValidate = [
    //     "newsletter_subscription",
    //     "terms_event_conditions",
    //     "prohibited_items",
    //   ];
    // }
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep((prev) => prev + 1);
    }
  };
  const onSubmit = async (data: SubmissionForm) => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setFormData((prevData) => ({ ...prevData, ...data }));
      // const finalData = {
      //   ...data,
      //   hackathon_id: hackathon_id,
      //   utm: utm != "" ? utm : utmSaved,
      //   interests: data.interests ?? [],
      //   languages: data.languages ?? [],
      //   roles: data.roles ?? [],
      //   tools: data.tools,
      // };
      // await saveRegisterForm(finalData);
      // setIsDialogOpen(true); // Abrir el diálogo después de guardar
    }
  };
  return (
    <div className="p-6  rounded-lg">
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
        {/* Barra de progreso */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Progress
            value={progress}
            className="rounded-full h-4 w-[294px] md:w-[430px]"
          />
          <span className="text-sm">
            {progress}% Complete - Finish your submission!
          </span>
        </div>

        {/* Deadline */}
        <Badge
          variant="outline"
          className="flex items-center gap-2  border-red-500 px-3 py-1"
        >
          <Hourglass size={16} color="#F5F5F9" />
          <span>Deadline: {timeLeft} remaining</span>
        </Badge>
      </div>

      {/* Contenedor principal con dos columnas: aside y contenido (formulario y botones) */}
      <div className="flex mt-6 gap-4 space-x-12">
        {/* Sidebar en la columna izquierda */}
        <aside className="w-16  flex-col items-center dark:bg-zinc-900 border border-zinc-800 px-2 py-2 gap-2 hidden sm:flex">
          <div className="p-2 space-y-4">
            <Tag className="cursor-pointer" color={step === 1 ? "#F5F5F9" : "#4F4F55"}   onClick={() => handleStepChange(1)}  />
            <Users className="cursor-pointer" color={step === 1 ? "#F5F5F9" : "#4F4F55"}   onClick={() => handleStepChange(1)}/>
            <Pickaxe className="cursor-pointer"color={step === 2 ? "#F5F5F9" : "#4F4F55"}   onClick={() => handleStepChange(2)}/>
            <Image className="cursor-pointer" color={step === 3 ? "#F5F5F9" : "#4F4F55"}  onClick={() => handleStepChange(3)} />
          </div>
        </aside>

        {/* Contenedor derecho que agrupa el formulario y la sección de botones/paginador */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Formulario */}
          <section>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >{step===1 &&<SubmitStep1 />}
                {step===2 &&<SubmitStep2 />}
                {step===3 &&<SubmitStep3 />}
                <Separator/>
                <div className="flex flex-col md:flex-row items-center justify-between mt-8">
                  {/* Contenedor de botones (alineados a la izquierda en desktop) */}
                  <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
                    <Button
                      type="submit"
                      variant="red"
                      className="px-4 py-2"
                    >
                      Continue
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="dark:bg-white dark:text-black px-4 py-2"
                    >
                      Save &amp; Continue Later
                    </Button>
                  </div>

                  {/* Contenedor derecho: paginador y paso */}
                  <div className="flex flex-col md:flex-row items-center">
                    {/* Paginador */}
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
                    {/* Indicador de paso: en md se ubica a la derecha, en móviles en nueva fila */}
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

          {/* Paginación y botones, debajo del formulario */}
        </div>
      </div>
    </div>
  );
}
