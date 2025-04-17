import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ambassador-dao/dialog";
import CustomButton from "../custom-button";
import { useCompleteJobMutation } from "@/services/ambassador-dao/requests/sponsor";
import { Checkbox } from "@/components/ui/checkbox";

interface IDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  applicantName: string;
  opportunityId: string;
  applicationId: string;
}

export const CompleteJobModal = ({
  isOpen,
  onClose,
  applicantName,
  opportunityId,
  applicationId,
}: IDeleteProps) => {
  const [isPaid, setIsPaid] = useState(false);
  const { mutateAsync: completeJob, isPending } = useCompleteJobMutation(
    applicationId,
    opportunityId
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-lg py-6 bg-[#fafafa] dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[var(--primary-text-color)] font-semibold'>
          Payment Method
        </DialogTitle>
        <div className='text-[var(--secondary-text-color)] my-3'>
          You've confirmed the submission from {applicantName}. Use the details
          below to arrange payment.
        </div>

        <hr className='my-4 md:my-6' />

        <div className='border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 transition-colors'>
          <div className='flex items-center space-x-2'>
            <Checkbox
              id='paid'
              checked={isPaid}
              onCheckedChange={() => setIsPaid(!isPaid)}
              color='var(--primary-text-color)'
              className='text-[var(--primary-text-color)]'
            />
            <label
              htmlFor='paid'
              className='text-sm text-[var(--primary-text-color)] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
            >
              Mark As Paid (offline)
            </label>
          </div>
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
            disabled={!isPaid}
            variant='danger'
            className='px-4 w-full'
            isLoading={isPending}
            onClick={async () => {
              await completeJob();
              onClose();
            }}
          >
            Confirm Payment
          </CustomButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};
