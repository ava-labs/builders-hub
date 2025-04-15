import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CustomButton from "../custom-button";
import { usePublishOpportunityMutation } from "@/services/ambassador-dao/requests/sponsor";
import Link from "next/link";

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
  const { mutateAsync: publishOpportunity, isPending } =
    usePublishOpportunityMutation(opportunityId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-lg py-6 bg-[#fafafa] dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[var(--primary-text-color)] font-semibold'>
          Publishing Confirmation
        </DialogTitle>
        <div className='text-[var(--secondary-text-color)] my-3'>
          Submit this listing for approval. It will be published once approved by the platform administrators.
        </div>
        <div className='flex gap-2 justify-center mt-6 md:mt-8'>
          <div className='flex justify-between space-x-3'>
            <Link href='/ambassador-dao/sponsor/listings'>
              <CustomButton
                variant='white'
                className='px-4 text-[#18181B]'
                onClick={onClose}
              >
                Cancel
              </CustomButton>
            </Link>

            <CustomButton
              variant={"danger"}
              className='px-4'
              isLoading={isPending}
              onClick={async () => {
                await publishOpportunity(true);
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
