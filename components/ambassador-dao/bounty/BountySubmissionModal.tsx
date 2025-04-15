"use client";

import React from "react";
import Modal from "../ui/Modal";
import { useSubmitBountySubmissions } from "@/services/ambassador-dao/requests/opportunity";
import { useForm } from "react-hook-form";

interface BountySubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bountyTitle?: string;
  id: string;
}

interface FormData {
  submissionLink: string;
  tweetLink: string;
  content: string;
}

const BountySubmissionModal: React.FC<BountySubmissionModalProps> = ({
  isOpen,
  onClose,
  bountyTitle = "Bounty",
  id,
}) => {
  const { mutateAsync: submitBounty, isPending: isSubmitting } =
    useSubmitBountySubmissions(id);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      submissionLink: "",
      tweetLink: "",
      content: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await submitBounty({
        submission_link: data.submissionLink,
        tweet_link: data.tweetLink || undefined,
        content: data.content || undefined,
      });
      reset();
      onClose();
    } catch (error) {
      console.error("Error submitting bounty:", error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${bountyTitle} Submission`}
      description="We can't wait to see what you've created!"
    >
      <div className='p-6'>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='space-y-6'>
            <div className='space-y-2'>
              <label className='block text-[var(--white-text-color)]'>
                Link to Your Submission
                <span className='text-red-500'>*</span>
              </label>
              <input
                type='url'
                placeholder='Add a link'
                className={`w-full bg-[#fff] dark:bg-[#000] border ${
                  errors.submissionLink
                    ? "border-red-500"
                    : "border-[var(--default-border-color)]"
                } rounded-md p-3 text-[var(--white-text-color)] placeholder-gray-500 focus:outline-none`}
                {...register("submissionLink", {
                  required: "Submission link is required",
                  pattern: {
                    value: /^(http|https):\/\/[^ "]+$/,
                    message: "Please enter a valid URL",
                  },
                })}
              />
              {errors.submissionLink && (
                <p className='mt-1 text-red-500 text-sm'>
                  {errors.submissionLink.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='block text-[var(--white-text-color)]'>Tweet Link</label>
              <input
                type='url'
                placeholder="Add a tweet's link"
                className={`w-full bg-[#fff] dark:bg-[#000] border ${
                  errors.tweetLink
                    ? "border-red-500"
                    : "border-[var(--default-border-color)]"
                } rounded-md p-3 text-[var(--white-text-color)] placeholder-gray-500 focus:outline-none`}
                {...register("tweetLink", {
                  pattern: {
                    value: /^(http|https):\/\/[^ "]+$/,
                    message: "Please enter a valid URL",
                  },
                })}
              />
              {errors.tweetLink && (
                <p className='mt-1 text-red-500 text-sm'>
                  {errors.tweetLink.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='block text-[var(--white-text-color)] cursor-pointer'>
                Anything Else?
              </label>

              <textarea
                placeholder="If you have any other links or information you'd like to share with us, please add them here!"
                rows={4}
                className={`w-full bg-[#fff] dark:bg-[#000] border ${
                  errors.content
                    ? "border-red-500"
                    : "border-[var(--default-border-color)]"
                } rounded-md p-3 text-[var(--white-text-color)] placeholder-gray-500 focus:outline-none`}
                {...register("content")}
              />
              {errors.content && (
                <p className='mt-1 text-red-500 text-sm'>
                  {errors.content.message}
                </p>
              )}
            </div>
          </div>

          <hr className='border-[var(--default-border-color)] my-6' />

          <button
            type='submit'
            disabled={isSubmitting}
            className='px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition flex items-center justify-center'
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </Modal>
  );
};

export { BountySubmissionModal };
