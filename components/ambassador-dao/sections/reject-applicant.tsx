import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CustomButton from "../custom-button";
import { useReviewApplicantMutation } from "@/services/ambassador-dao/requests/sponsor";
import CustomInput from "../input";

interface IDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  applicantName: string;
  applicationId: string;
}

export const RejectApplicantModal = ({
  isOpen,
  onClose,
  applicantName,
  applicationId,
}: IDeleteProps) => {
  const [feedback, setFeedback] = useState("");
  const { mutateAsync: reviewApplicant, isPending } =
    useReviewApplicantMutation(applicationId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-lg py-6 bg-[#fafafa] dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[var(--primary-text-color)] font-semibold'>
          Reject Applicant
        </DialogTitle>
        <div className='text-[var(--secondary-text-color)] my-3'>
          Are you sure you want to Reject Applicant,{" "}
          <span className='font-semibold text-[#FB2C36]'>{applicantName}</span>{" "}
          ?
        </div>

        <CustomInput
          label='Feedback'
          placeholder='Enter feedback'
          name='feedback'
          type='text'
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />

        <div className='text-[var(--secondary-text-color)] text-xs my-3'>
          Please provide a feedback for the applicant. This will be sent to the
          applicant.
        </div>

        <div className='flex gap-2 justify-between mt-6 md:mt-8'>
          <CustomButton
            variant='white'
            className='px-4 text-[#18181B] w-full'
            onClick={onClose}
          >
            Cancel
          </CustomButton>
          <CustomButton
            variant={"danger"}
            className='px-4 w-full'
            isLoading={isPending}
            onClick={async () => {
              await reviewApplicant({
                status: "REJECTED",
                feedback: feedback,
              });
              onClose();
            }}
          >
            Reject Applicant
          </CustomButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};
