"use client";

import { useState } from "react";
import Modal from "../ui/Modal";
import { Upload, Loader2 } from "lucide-react";
import { useFileUploadMutation } from "@/services/ambassador-dao/requests/onboard";
import { useSubmitJobApplication } from "@/services/ambassador-dao/requests/opportunity";
import { useForm, SubmitHandler } from "react-hook-form";
import toast from "react-hot-toast";

interface JobApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle?: string;
  customQuestions?: string[];
  id: string;
}

interface FormData {
  telegram_username: string;
  cover_letter: string;
  custom_question_answers: Array<{
    question: string;
    answer: string;
  }>;
}

const JobApplicationModal: React.FC<JobApplicationModalProps> = ({
  isOpen,
  onClose,
  jobTitle = "Job",
  customQuestions,
  id,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [filesPreviews, setFilesPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: uploadFile } = useFileUploadMutation("document");
  const { mutateAsync: submitApplication, isPending: isSubmitting } =
    useSubmitJobApplication(id);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      telegram_username: "",
      cover_letter: "",
      custom_question_answers: customQuestions
        ? customQuestions.map((q) => ({ question: q, answer: "" }))
        : [],
    },
  });

  const handleFileUpload = async (selectedFiles: File[]) => {
    if (files.length + selectedFiles.length > 3) {
      toast.error("Maximum 3 files are allowed");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const invalidFiles = selectedFiles.filter(
      (file) => !allowedTypes.includes(file.type)
    );
    if (invalidFiles.length > 0) {
      toast.error(
        `Invalid file type(s). Only PDF and Word documents are allowed.`
      );
      return;
    }

    const oversizedFiles = selectedFiles.filter(
      (file) => file.size > 1024 * 1024
    );
    if (oversizedFiles.length > 0) {
      toast.error(
        `Some files exceed the 1MB limit: ${oversizedFiles
          .map((f) => f.name)
          .join(", ")}`
      );
      return;
    }

    try {
      setIsUploading(true);

      const uploadPromises = selectedFiles.map((file) => uploadFile(file));
      const results = await Promise.all(uploadPromises);

      const newFiles = [...files, ...selectedFiles];
      const newFileIds = [...fileIds, ...results.map((r) => r.file.id)];

      setFiles(newFiles);
      setFileIds(newFileIds);

      selectedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilesPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileIds((prev) => prev.filter((_, i) => i !== index));
    setFilesPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      await handleFileUpload(droppedFiles);
    }
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const payload = {
        telegram_username: data.telegram_username,
        cover_letter: data.cover_letter,
        file_ids: fileIds,
        custom_question_answers: data.custom_question_answers,
      };

      await submitApplication(payload);

      reset();
      setFiles([]);
      setFileIds([]);
      setFilesPreviews([]);

      onClose();
    } catch (error) {
      console.error("Error submitting application:", error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Submit Your Application'
      description="Don't start working just yet! Apply first, and then begin working only once you've been hired for the project by the sponsor. Please note that the sponsor might contact you to assess fit before picking the winner."
    >
      <div className='p-6'>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='space-y-6'>
            <div className='space-y-2'>
              <label className='block text-white'>
                Your telegram<span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                placeholder='Your telegram'
                className={`w-full bg-[#fff] dark:bg-[#000] border ${
                  errors.telegram_username
                    ? "border-red-500"
                    : "border-[var(--default-border-color)]"
                } rounded-md p-3 text-[var(--white-text-color)] placeholder-gray-500 focus:outline-none`}
                {...register("telegram_username", {
                  required: "Telegram username is required",
                })}
              />
              {errors.telegram_username && (
                <p className='text-red-500 text-sm mt-1'>
                  {errors.telegram_username.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='block text-white'>
                Resumes Or Cover Letters
              </label>
              <p className='text-sm text-[var(--secondary-text-color)] mb-2'>
                Upload your cover letter or resume here. Max 3 documents
              </p>

              <div
                className='border-2 border-dashed border-[var(--default-border-color)] rounded-md p-6 text-center bg-[var(--default-background-color)] cursor-pointer'
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                {filesPreviews.length > 0 && (
                  <div
                    className='flex flex-wrap gap-4 mb-4'
                    onClick={(e) => e.stopPropagation()}
                  >
                    {filesPreviews.map((preview, index) => (
                      <div key={index} className='relative'>
                        <div className='w-24 h-24 border border-[var(--default-border-color)] rounded flex items-center justify-center'>
                          <div className='text-xs text-[var(--secondary-text-color)]'>
                            {files[index]?.name.substring(0, 10)}...
                          </div>
                        </div>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className='absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-xs'
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {files.length < 3 && (
                  <div className='py-8 flex flex-col items-center'>
                    {isUploading ? (
                      <Loader2 className='h-8 w-8 text-[var(--secondary-text-color)] mb-2 animate-spin' />
                    ) : (
                      <>
                        <Upload
                          className='h-12 w-12 mb-2'
                          color='var(--white-text-color)'
                        />
                        <p className='text-[var(--primary-text-color)] mb-2'>
                          Drag your file(s) or click anywhere in this area to
                          browse
                          <input
                            type='file'
                            className='hidden'
                            id='fileInput'
                            multiple
                            accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                const selectedFiles = Array.from(
                                  e.target.files
                                );
                                handleFileUpload(selectedFiles);
                              }
                            }}
                          />
                        </p>
                        <p className='text-xs text-[var(--secondary-text-color)]'>
                          Max 1 MB files are allowed (PDF, DOC, DOCX)
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {customQuestions &&
              customQuestions.map((q, index) => (
                <div key={index} className='space-y-2'>
                  <label className='block text-white'>
                    {q}
                    <span className='text-red-500'>*</span>
                  </label>
                  <textarea
                    placeholder='Answer question here'
                    rows={2}
                    className={`w-full bg-[#fff] dark:bg-[#000] border ${
                      errors.custom_question_answers &&
                      errors.custom_question_answers[index]
                        ? "border-red-500"
                        : "border-[var(--default-border-color)]"
                    } rounded-md p-3 text-[var(--white-text-color)] placeholder-gray-500 focus:outline-none`}
                    {...register(
                      `custom_question_answers.${index}.answer` as const,
                      {
                        required: "Answer is required",
                      }
                    )}
                  />
                  {errors.custom_question_answers &&
                    errors.custom_question_answers[index] && (
                      <p className='text-red-500 text-sm mt-1'>
                        {errors.custom_question_answers[index]?.answer?.message}
                      </p>
                    )}
                </div>
              ))}

            <div className='space-y-2'>
              <label className='block text-white'>Anything Else?</label>
              <textarea
                placeholder='Add info or link...'
                rows={3}
                className='w-full bg-[#fff] dark:bg-[#000] border border-[var(--default-border-color)] rounded-md p-3 text-[var(--white-text-color)] placeholder-gray-500 focus:outline-none'
                {...register("cover_letter")}
              />
            </div>
          </div>

          <hr className='border-[var(--default-border-color)] my-6' />

          <button
            type='submit'
            disabled={isSubmitting}
            className='px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition flex items-center gap-2 justify-center'
          >
            {isSubmitting && <Loader2 className='animate-spin h-4 w-4' />}
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </Modal>
  );
};

export default JobApplicationModal;
