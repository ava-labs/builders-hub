import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ambassador-dao/dialog";
import CustomButton from "../custom-button";
import { useDeleteOpportunityMutation } from "@/services/ambassador-dao/requests/sponsor";

interface IDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
}

export const DeleteOpportunityModal = ({
  isOpen,
  onClose,
  opportunityId,
}: IDeleteProps) => {
  const { mutateAsync: deleteOpportunity, isPending } =
    useDeleteOpportunityMutation(opportunityId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-lg py-6 bg-[#fafafa] dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[var(--primary-text-color)] font-semibold'>
          Delete Opportunity
        </DialogTitle>
        <div className='text-[var(--secondary-text-color)] my-3'>
          Are you sure you want to delete this opportunity? This action cannot
          be undone.
        </div>

        <div className='flex gap-2 justify-center mt-6 md:mt-8'>
          <div className='flex justify-between space-x-3'>
            <CustomButton
              variant='white'
              className='px-4 text-[#18181B]'
              onClick={onClose}
            >
              Cancel
            </CustomButton>
            <CustomButton
              variant={"danger"}
              className='px-4'
              isLoading={isPending}
              onClick={async () => {
                await deleteOpportunity();
                onClose();
              }}
            >
              Continue
            </CustomButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
