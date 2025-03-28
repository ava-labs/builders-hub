import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CustomButton from "../custom-button";

interface IPublishProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
}

export const PublishOpportunityModal = ({
  isOpen,
  onClose,
  opportunityId,
}: IPublishProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-lg py-6 bg-gray-50 dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[#FAFAFA] font-semibold'>
          Publishing Confirmation
        </DialogTitle>
        <div className='text-[#9F9FA9] my-3'>
          Approval may take xx hours, This content will be visible to all users
          upon publishing.
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
            <CustomButton variant={"danger"} className='px-4'>
              Continue
            </CustomButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
