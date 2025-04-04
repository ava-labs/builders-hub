"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format, addWeeks } from "date-fns";
import {
  CalendarIcon,
  Plus,
  ArrowLeft,
  Eye,
  BriefcaseBusiness,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import UsdcToken from "@/public/images/usdc-token.svg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CustomButton from "../custom-button";
import CustomInput from "../input";
import { useFetchAllSkills } from "@/services/ambassador-dao/requests/onboard";
import {
  useCreateOpportunityMutation,
  useFetchSingleListing,
  useUpdateOpportunityMutation,
} from "@/services/ambassador-dao/requests/sponsor";
import { ICreateOpportunityBody } from "@/services/ambassador-dao/interfaces/sponsor";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import dynamic from "next/dynamic";
import FullScreenLoader from "../full-screen-loader";
import { PublishOpportunityModal } from "./publish-opportunity-modal";
const MarkdownEditor = dynamic(() => import("../markdown-editor"), {
  ssr: false,
});

export default function AmbasssadorDaoSponsorsCreateListing({
  type,
  id,
}: {
  type?: "JOB" | "BOUNTY";
  id?: string;
}) {
  const router = useRouter();
  const { data: skills } = useFetchAllSkills();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const { data: listingDetails, isLoading } = useFetchSingleListing(id);

  const {
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<ICreateOpportunityBody>({
    defaultValues: {
      title: "",
      description: "",
      type: type,
      category: "PUBLIC",
      start_date: null,
      end_date: null,
      requirements: "",
      max_winners: 1,
      total_budget: 0,
      skill_ids: [],
      file_ids: [],
      custom_questions: [],
      point_of_contact: "",
      prize_distribution: type === "BOUNTY" ? [{ position: 1, amount: 0 }] : [],
      should_publish: false,
    },
  });

  // Prize distribution field array for BOUNTY type
  const {
    fields: prizeFields,
    append: appendPrize,
    remove: removePrize,
  } = useFieldArray({
    control,
    name: "prize_distribution",
  });

  // Watch for form values
  const startDate = watch("start_date");
  const formType = watch("type");
  const customQuestionFields = watch("custom_questions");

  // Set selected skills in form when they change
  useEffect(() => {
    setValue("skill_ids", selectedSkills);
  }, [selectedSkills, setValue]);

  // Populate form with listing details when in edit mode
  useEffect(() => {
    if (id && listingDetails) {
      setValue("title", listingDetails.title);
      setValue("description", listingDetails.description);
      setValue("type", listingDetails.type);
      setValue("category", listingDetails.category as "PUBLIC" | "PRIVATE");
      setValue("start_date", new Date(listingDetails.start_date));
      setValue("end_date", new Date(listingDetails.end_date));
      setValue("requirements", listingDetails.requirements);
      setValue("max_winners", listingDetails.max_winners);
      setValue("total_budget", listingDetails.total_budget);
      setValue(
        "skill_ids",
        listingDetails.skills.map((skill) => skill.id)
      );
      setValue("file_ids", listingDetails.files);
      setValue("custom_questions", listingDetails.custom_questions || []);
      setValue("point_of_contact", listingDetails.point_of_contact);
      if (listingDetails.prize_distribution) {
        setValue("prize_distribution", listingDetails.prize_distribution);
      }
      setSelectedSkills(listingDetails.skills.map((skill) => skill.id));
    }
  }, [listingDetails, setValue]);

  const { mutateAsync: submitOpportunity, isPending: isCreatePending } =
    useCreateOpportunityMutation();

  const { mutateAsync: updateOpportunity, isPending: isUpdatePending } =
    useUpdateOpportunityMutation(id || "");

  const isPending = isCreatePending || isUpdatePending;

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [buttonState, setButtonState] = useState<string>("");

  useEffect(() => {
    if (isDirty && isNavigating) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to leave?"
        )
      ) {
        router.back();
      }
      setIsNavigating(false);
    }
  }, [pathname, searchParams, isDirty, router, isNavigating]);

  const goBack = () => {
    setIsNavigating(true);
    router.push("/ambassador-dao/sponsor/listings");
  };

  const onSubmitContinue = async (data: ICreateOpportunityBody) => {
    if (id) {
      await updateOpportunity(data);
      setOpportunityId(id);
      setIsPublishModalOpen(true);
    } else {
      const res = await submitOpportunity(data);
      setOpportunityId(res.data.id);
      setIsPublishModalOpen(true);
    }
    reset();
  };

  const onSubmitPreview = async (data: ICreateOpportunityBody) => {
    if (id) {
      const res = await updateOpportunity(data);
      router.push(
        `/ambassador-dao/sponsor/listing/${id ?? res.data.id}/preview`
      );
    } else {
      const res = await submitOpportunity(data);
      router.push(`/ambassador-dao/sponsor/listing/${res.data.id}/preview`);
    }
    reset();
  };

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill) && skill) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const removeSkill = (skill: string) => {
    const updated = selectedSkills.filter((s) => s !== skill);
    setSelectedSkills(updated);
  };

  // Function to add a custom question
  const addCustomQuestion = () => {
    const updatedQuestions = [...(customQuestionFields || []), ""];
    setValue("custom_questions", updatedQuestions);
  };

  // Function to remove a custom question
  const removeCustomQuestion = (index: number) => {
    const updatedQuestions = customQuestionFields?.filter(
      (_, i) => i !== index
    );
    setValue("custom_questions", updatedQuestions);
  };

  // Helper function to set end date based on weeks from start date
  const setEndDateFromWeeks = (weeks: number) => {
    if (startDate) {
      const newEndDate = addWeeks(new Date(startDate), weeks);
      setValue("end_date", newEndDate);
    }
  };

  // Calculate total budget for BOUNTY type
  const calculateTotalBudget = () => {
    const prizes = watch("prize_distribution") || [];
    const total = prizes.reduce((sum, prize) => sum + (prize.amount || 0), 0);
    setValue("total_budget", total);
  };

  // Update total budget when prize amounts change
  useEffect(() => {
    const type = watch("type");
    if (type === "BOUNTY") {
      calculateTotalBudget();
      const prizes = watch("prize_distribution") || [];
      setValue("max_winners", prizes.length);
    }
  }, [watch("prize_distribution")]);

  useEffect(() => {
    const type = watch("type");
    if (type === "JOB") {
      setValue("max_winners", 1);
    }
  }, [watch("type")]);

  // Handle unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  return (
    <>
      {isLoading ? (
        <FullScreenLoader />
      ) : (
        <>
          {" "}
          <div className='p-4 md:p-8 m-4 md:m-8 bg-[var(--default-background-color)] border border-[var(--default-border-color)] rounded-md'>
            <div className='max-w-7xl mx-auto'>
              <div className='flex justify-between mb-8'>
                <Button
                  variant='outline'
                  onClick={goBack}
                  className='text-[var(--primary-text-color)] border-[var(--default-border-color)]'
                >
                  <ArrowLeft
                    className='mr-1 h-4 w-4'
                    color='var(--primary-text-color)'
                  />{" "}
                  Go Back
                </Button>

                <div className='flex space-x-3'>
                  <CustomButton
                    variant='white'
                    className='px-4'
                    onClick={() => {
                      setButtonState("preview");
                      handleSubmit(onSubmitPreview)();
                    }}
                    isLoading={isPending && buttonState === "preview"}
                    disabled={
                      (type === "BOUNTY" && prizeFields.length === 0) ||
                      selectedSkills.length === 0 ||
                      isPending
                    }
                  >
                    <Eye
                      className='mr-1 h-4 w-4'
                      color='var(--black-background-color)'
                    />
                    Preview
                  </CustomButton>
                  <CustomButton
                    onClick={() => {
                      setButtonState("continue");
                      handleSubmit(onSubmitContinue)();
                    }}
                    isLoading={isPending && buttonState === "continue"}
                    variant={"danger"}
                    className='px-4'
                    disabled={
                      (type === "BOUNTY" && prizeFields.length === 0) ||
                      selectedSkills.length === 0 ||
                      isPending
                    }
                  >
                    Continue
                  </CustomButton>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmitContinue)}>
                <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
                  <div className='lg:col-span-2 space-y-6'>
                    {/* Title Section */}
                    <div className='space-y-1'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        Listing Title
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <div className='flex items-center gap-2'>
                        <Controller
                          name='type'
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              iconColor='var(--primary-text-color)'
                            >
                              <SelectTrigger className='min-w-32 bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:outline-none !h-10 my-2'>
                                <SelectValue placeholder='Select' />
                              </SelectTrigger>
                              <SelectContent className='bg-[#fafafa] dark:bg-[#09090B] text-[var(--primary-text-color)]'>
                                <SelectItem value='JOB'>
                                  <div className='flex items-center'>
                                    <BriefcaseBusiness
                                      className='mr-2'
                                      color='var(--primary-text-color)'
                                    />
                                    Job
                                  </div>
                                </SelectItem>
                                <SelectItem value='BOUNTY'>
                                  <div className='flex items-center'>
                                    <BriefcaseBusiness
                                      className='mr-2'
                                      color='var(--primary-text-color)'
                                    />
                                    Bounty
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />

                        <Controller
                          name='title'
                          control={control}
                          rules={{ required: "Title is required" }}
                          render={({ field }) => (
                            <CustomInput
                              {...field}
                              className='w-full'
                              placeholder='Create a High-Energy Video Montage About Sendit & Earn!'
                            />
                          )}
                        />
                      </div>
                      {errors.title && (
                        <p className='text-red-500 text-xs mt-1'>
                          {errors.title.message}
                        </p>
                      )}
                    </div>

                    {/* Requirements Section */}
                    <div className='space-y-2'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        Requirements
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <Controller
                        name='requirements'
                        control={control}
                        rules={{ required: "Requirements is required" }}
                        render={({ field }) => (
                          <CustomInput
                            {...field}
                            className='w-full'
                            placeholder='English speaking candidates only'
                          />
                        )}
                      />
                      {errors.requirements && (
                        <p className='text-red-500 text-xs mt-1'>
                          {errors.requirements.message}
                        </p>
                      )}
                    </div>

                    {/* Description Section */}
                    <div className='space-y-2'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        Description
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <Suspense fallback={null}>
                        <MarkdownEditor 
                          markdown={getValues("description")}
                          setValue={setValue}
                        />
                      </Suspense>
                      {errors.description && (
                        <p className='text-red-500 text-xs mt-1'>
                          {errors.description.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className='lg:col-span-1 space-y-6'>
                    {/* Rewards Section - Conditional based on type */}
                    {formType === "JOB" ? (
                      <div className='space-y-1'>
                        <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                          Add Rewards
                          <span className='text-red-500 ml-1'>*</span>
                        </label>
                        <div className='flex items-center gap-2'>
                          <Select
                            defaultValue='USDC'
                            iconColor='var(--primary-text-color)'
                          >
                            <SelectTrigger className='min-w-32 bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:outline-none !h-10 my-2'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className='bg-[var(--default-background-color)] text-[var(--primary-text-color)]'>
                              <SelectItem value='USDC'>
                                <div className='flex items-center'>
                                  <Image
                                    src={UsdcToken}
                                    alt='usdc token'
                                    width={20}
                                    height={20}
                                    className='mr-2'
                                  />
                                  USDC
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          <Controller
                            name='total_budget'
                            control={control}
                            rules={{ required: "Reward is required" }}
                            render={({ field }) => (
                              <CustomInput
                                {...field}
                                type='number'
                                className='w-full'
                                placeholder='100'
                                onChange={(e) =>
                                  field.onChange(Number(e.target.value))
                                }
                              />
                            )}
                          />
                        </div>
                        {errors.total_budget && (
                          <p className='text-red-500 text-xs mt-1'>
                            {errors.total_budget.message}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className='space-y-4'>
                        <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                          Prize Distribution
                          <span className='text-red-500 ml-1'>*</span>
                        </label>
                        {!prizeFields.length && (
                          <>
                            <p className='text-red-500 text-xs mt-1'>
                              Please add a prize
                            </p>
                          </>
                        )}

                        {prizeFields.map((field, index) => (
                          <div key={field.id} className='space-y-1'>
                            <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                              {index === 0
                                ? "First Prize"
                                : index === 1
                                ? "Second Prize"
                                : index === 2
                                ? "Third Prize"
                                : `${index + 1}th Prize`}
                            </label>
                            <div className='flex items-center gap-2'>
                              <Select
                                defaultValue='USDC'
                                onValueChange={() => {}}
                              >
                                <SelectTrigger className='min-w-32 bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:outline-none !h-10 my-2'>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className='bg-[var(--default-background-color)] text-[var(--primary-text-color)]'>
                                  <SelectItem value='USDC'>
                                    <div className='flex items-center'>
                                      <Image
                                        src={UsdcToken}
                                        alt='usdc token'
                                        width={20}
                                        height={20}
                                        className='mr-2'
                                      />
                                      USDC
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              <Controller
                                name={`prize_distribution.${index}.amount`}
                                control={control}
                                rules={{ required: "Prize amount is required" }}
                                render={({ field }) => (
                                  <CustomInput
                                    {...field}
                                    type='number'
                                    className='w-full'
                                    placeholder='100'
                                    onChange={(e) => {
                                      field.onChange(Number(e.target.value));
                                      calculateTotalBudget();
                                    }}
                                  />
                                )}
                              />

                              {index > 0 && (
                                <Button
                                  type='button'
                                  variant='ghost'
                                  size='icon'
                                  onClick={() => removePrize(index)}
                                  className='text-red-500 px-3'
                                >
                                  <Trash2 className='h-4 w-4' color='red' />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}

                        <div className='flex justify-end'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-6 py-1 text-xs text-[var(--primary-text-color)] hover:bg-none'
                            onClick={() =>
                              appendPrize({
                                position: prizeFields.length + 1,
                                amount: 0,
                              })
                            }
                          >
                            <Plus
                              className='h-3 w-3 mr-1'
                              color='var(--primary-text-color)'
                            />
                            Add Individual Prize Position
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Start Date Section */}
                    <div className='space-y-2'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        Start Date (in America/New_York)
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <div className='flex flex-col space-y-2'>
                        <Controller
                          name='start_date'
                          control={control}
                          rules={{ required: "Start date is required" }}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant='outline'
                                  className='bg-[var(--default-background-color)] border-[var(--default-border-color)] justify-between text-left font-normal'
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon
                                    className='h-4 w-4 opacity-50'
                                    color='var(--primary-text-color)'
                                  />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className='w-auto p-0'
                                align='start'
                              >
                                <Calendar
                                  mode='single'
                                  selected={
                                    field.value
                                      ? new Date(field.value)
                                      : undefined
                                  }
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    // Close popover when date is selected
                                    document.body.click();
                                  }}
                                  initialFocus
                                  className='text-[var(--primary-text-color)] bg-[#fafafa] dark:bg-[#09090B]'
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                      </div>
                      {errors.start_date && (
                        <p className='text-red-500 text-xs mt-1'>
                          {errors.start_date.message}
                        </p>
                      )}
                    </div>

                    {/* End Date Section */}
                    <div className='space-y-2'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        End Date (in America/New_York)
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <div className='flex flex-col space-y-2'>
                        <Controller
                          name='end_date'
                          control={control}
                          rules={{ required: "End date is required" }}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant='outline'
                                  className='bg-[var(--default-background-color)] border-[var(--default-border-color)] justify-between text-left font-normal'
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon
                                    className='h-4 w-4 opacity-50'
                                    color='var(--primary-text-color)'
                                  />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className='w-auto p-0'
                                align='start'
                              >
                                <Calendar
                                  mode='single'
                                  selected={
                                    field.value
                                      ? new Date(field.value)
                                      : undefined
                                  }
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    // Close popover when date is selected
                                    document.body.click();
                                  }}
                                  initialFocus
                                  className='text-[var(--primary-text-color)] bg-[#fafafa] dark:bg-[#09090B]'
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />

                        <div className='flex space-x-2'>
                          {[
                            { label: "1 Week", weeks: 1 },
                            { label: "2 Weeks", weeks: 2 },
                            { label: "3 Weeks", weeks: 3 },
                          ].map((period, i) => {
                            const endDate = watch("end_date");
                            const isActive =
                              startDate &&
                              endDate &&
                              Math.round(
                                (new Date(endDate).getTime() -
                                  new Date(startDate).getTime()) /
                                  (7 * 24 * 60 * 60 * 1000)
                              ) === period.weeks;

                            return (
                              <Button
                                key={period.label}
                                type='button'
                                variant='outline'
                                className={cn(
                                  "bg-transparent border-[var(--default-border-color)] rounded-full text-xs px-3 h-8",
                                  isActive && "border-blue-500 bg-blue-500/10"
                                )}
                                onClick={() =>
                                  setEndDateFromWeeks(period.weeks)
                                }
                              >
                                {period.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      {errors.end_date && (
                        <p className='text-red-500 text-xs mt-1'>
                          {errors.end_date.message}
                        </p>
                      )}
                    </div>

                    {/* Skills Section */}
                    <div className='space-y-2'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        Skills Needed
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <div className='w-full min-h-10 flex flex-wrap gap-2 px-2 py-2 rounded-md bg-[var(--default-background-color)] border border-[var(--default-border-color)] text-[var(--primary-text-color)] focus:outline-none focus:border-[#FB2C36] overflow-x-auto'>
                        {selectedSkills.map((skillId, idx) => {
                          const skillName =
                            skills?.find((skill) => skill.id === skillId)
                              ?.name || skillId;
                          return (
                            <div
                              key={idx}
                              className='flex items-center gap-2 bg-gray-200 dark:bg-[#fff] text-[#18181B] rounded-full px-2 text-xs cursor-pointer capitalize'
                              onClick={() => removeSkill(skillId)}
                            >
                              {skillName}
                              <X size={14} color='#18181B' />
                            </div>
                          );
                        })}
                      </div>
                      <div className='flex flex-wrap gap-2 mt-4'>
                        {skills && skills.length > 0 ? (
                          skills.map((badge, idx) => (
                            <div
                              key={idx}
                              className='flex items-center gap-2 bg-[var(--default-background-color)] border border-[var(--default-border-color)] rounded-full px-3 py-1 text-xs cursor-pointer capitalize'
                              onClick={() => addSkill(badge.id)}
                            >
                              {badge.name}
                              <Plus size={14} color='#A1A1AA' />
                            </div>
                          ))
                        ) : (
                          <p className='text-center text-sm font-thin'>
                            No skills available
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contact Section */}
                    <div className='space-y-2'>
                      <label className='flex text-[var(--primary-text-color)] text-sm font-medium'>
                        Point of Contact (TG / X / Email)
                        <span className='text-red-500 ml-1'>*</span>
                      </label>
                      <Controller
                        name='point_of_contact'
                        control={control}
                        rules={{ required: "Contact information is required" }}
                        render={({ field }) => (
                          <CustomInput
                            {...field}
                            type='text'
                            className='bg-[var(--default-background-color)] border-[var(--default-border-color)]'
                          />
                        )}
                      />
                      {errors.point_of_contact && (
                        <p className='text-red-500 text-xs mt-1'>
                          {errors.point_of_contact.message}
                        </p>
                      )}
                    </div>

                    {/* Custom Questions Section */}
                    <div className='space-y-2'>
                      <h3 className='text-lg font-semibold'>
                        Custom Questions
                      </h3>

                      {!customQuestionFields?.length && (
                        <>
                          <p className=' text-xs mt-1'>No questions added</p>
                        </>
                      )}

                      {customQuestionFields?.map((field, index) => (
                        <div key={index} className='flex gap-2 items-center'>
                          <Controller
                            name={`custom_questions.${index}`}
                            control={control}
                            render={({ field }) => (
                              <CustomInput
                                {...field}
                                className='bg-[var(--default-background-color)] border-[var(--default-border-color)] flex-1'
                                placeholder='Enter your question'
                              />
                            )}
                          />
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => removeCustomQuestion(index)}
                            className='text-red-500 px-2'
                          >
                            <Trash2 className='h-4 w-4' color='red' />
                          </Button>
                        </div>
                      ))}

                      <div className='flex justify-end'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='h-6 py-2 text-sm text-[var(--primary-text-color)] hover:bg-none'
                          onClick={addCustomQuestion}
                        >
                          <Plus
                            className='h-3 w-3 mr-1'
                            color='var(--primary-text-color)'
                          />{" "}
                          Add Question
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
          {opportunityId && (
            <PublishOpportunityModal
              isOpen={isPublishModalOpen}
              onClose={() => setIsPublishModalOpen(false)}
              opportunityId={opportunityId}
            />
          )}
        </>
      )}
    </>
  );
}
