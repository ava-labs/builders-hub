import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CustomButton from "../custom-button";
import {
  useFetchSingleListing,
  useFetchSingleListingSubmission,
  useReviewSubmissionMutation,
  useUpdateBountyRewardMutation,
} from "@/services/ambassador-dao/requests/sponsor";
import CustomInput from "../input";
import Loader from "../ui/Loader";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import Image from "next/image";
import { Hourglass, Link } from "lucide-react";
import { useFetchUserStatsDataQuery } from "@/services/ambassador-dao/requests/auth";
import CustomSelect from "../select";

interface IDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
}

export const SumbissionReviewDetailsModal = ({
  isOpen,
  onClose,
  submissionId,
}: IDeleteProps) => {
  const [feedback, setFeedback] = useState("");
  const { data: submission, isLoading } =
    useFetchSingleListingSubmission(submissionId);

  const { data: userStats } = useFetchUserStatsDataQuery(
    submission?.submitter.username
  );

  const { data: listing } = useFetchSingleListing(submission?.opportunity.id);

  const { mutate: reviewSubmission, isPending: isReviewing } =
    useReviewSubmissionMutation(submissionId);

  const [rewardId, setRewardId] = useState<string | null>(null);

  const { mutateAsync: updateBountyReward, isPending: isUpdatingBounty } =
    useUpdateBountyRewardMutation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-2xl py-6 bg-gray-50 dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[#FAFAFA] font-semibold'>
          Applicant Details
        </DialogTitle>
        <div className='text-[#9F9FA9] my-3'>
          Review the details of this submission before making a decision.
        </div>

        <hr className='my-4 md:my-6' />

        {isLoading ? (
          <Loader />
        ) : (
          submission && (
            <div className='space-y-6 md:space-y-8'>
              <div className='bg-[#18181B] border border-[#27272A] p-2 rounded-lg md:p-4 hover:border-black transition-colors'>
                <div className='flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4'>
                  <div className='flex md:items-center gap-3'>
                    <div>
                      <Image
                        src={
                          submission.submitter.profile_image ?? DefaultAvatar
                        }
                        alt='user profile'
                        width={60}
                        height={60}
                        className='shrink-0 rounded-full'
                      />
                    </div>
                    <div>
                      <h3 className='text-lg font-medium text-white'>
                        {submission.submitter.role ?? "--"}
                      </h3>
                      <p className='text-gray-400 font-light text-sm'>
                        {submission.submitter.first_name}{" "}
                        {submission.submitter.last_name}
                      </p>
                      <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                        <div className='flex items-center text-sm text-gray-400'>
                          <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                          Submitted:{" "}
                          {new Date(submission.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <CustomButton
                    className='px-3 bg-[#FB2C3633] text-[#FB2C36]'
                    isFullWidth={false}
                  >
                    Contributor
                  </CustomButton>
                </div>
              </div>

              <div>
                <p className='text-[#FAFAFA] font-semibold'>Skills</p>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {submission.submitter.skills.map((skill) => (
                    <div
                      className='text-xs px-2 py-1 rounded-full text-center border border-[#27272A]'
                      key={skill.id}
                    >
                      {skill.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
                <div className=''>
                  <p className='text-[#FAFAFA] font-semibold'>Experience</p>
                  <p className='text-[#9F9FA9] text-sm'>-- years</p>
                </div>
                <div className=''>
                  <p className='text-[#FAFAFA] font-semibold'>Success Rate</p>
                  <p className='text-[#9F9FA9] text-sm'>--%</p>
                </div>
                <div className=''>
                  <p className='text-[#FAFAFA] font-semibold'>Completed Jobs</p>
                  <p className='text-[#9F9FA9] text-sm'>--</p>
                </div>
              </div>

              <div>
                <p className='text-[#FB2C36] font-semibold'>Submission Link</p>
                <div className='space-y-3 mt-2'>
                  {!submission.files.length && (
                    <div className='text-[#9F9FA9] text-sm'>
                      No files uploaded
                    </div>
                  )}
                  {submission.files.map((file) => (
                    <div className='flex flex-col md:flex-row gap-2 justify-between'>
                      <div className='flex gap-2 items-center'>
                        <Link size={16} color='#9F9FA9' />
                        <p className='font-semibold text-[#FAFAFA]'>
                          {file.original_name}
                          <span className='text-[#9F9FA9]'>--mb</span>
                        </p>
                      </div>
                      <p className='text-[#fafafa]'>Download</p>
                    </div>
                  ))}
                </div>
              </div>

              {submission.status === "ACCEPTED" ? (
                <>
                  <CustomSelect
                    id='location'
                    label='Select Winner'
                    onChange={(e) => setRewardId(e.target.value)}
                  >
                    <option value=''>Select</option>
                    {listing?.prize_distribution?.map((reward, idx) => (
                      <option value={reward.position} key={idx}>
                        {reward.position === 1
                          ? "First Prize"
                          : reward.position === 2
                          ? "Second Prize"
                          : reward.position === 3
                          ? "Third Prize"
                          : `${reward.position + 1}th Prize`}
                      </option>
                    ))}
                  </CustomSelect>

                  <div className='flex gap-2 justify-between mt-6 md:mt-8'>
                    <CustomButton
                      variant='white'
                      className='px-4 text-[#18181B] w-full'
                      onClick={onClose}
                    >
                      Cancel
                    </CustomButton>
                    <CustomButton
                      variant='danger'
                      className='px-4 w-full'
                      disabled={!rewardId}
                      onClick={async () => {
                        if (!rewardId) return;
                        await updateBountyReward({
                          winner_id: submission.submitter.id,
                          opportunityId: submission.opportunity.id,
                          rewardId: rewardId,
                        });
                        onClose();
                      }}
                      isLoading={isUpdatingBounty}
                    >
                      Confirm Reward
                    </CustomButton>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <CustomInput
                      label='Feedback'
                      placeholder='Enter feedback'
                      name='feedback'
                      type='text'
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />

                    <div className='text-[#9F9FA9] text-xs my-3'>
                      Please provide a feedback for the applicant. This will be
                      sent to the applicant.
                    </div>
                  </div>
                  <div className='flex gap-2 justify-between mt-6 md:mt-8'>
                    <CustomButton
                      variant='outlined'
                      className='px-4 text-[#18181B] w-full'
                      disabled={isReviewing}
                      isLoading={isReviewing}
                      onClick={() =>
                        reviewSubmission({ status: "REJECTED", feedback })
                      }
                    >
                      Reject Submission
                    </CustomButton>
                    <CustomButton
                      variant='danger'
                      className='px-4 w-full'
                      disabled={isReviewing}
                      isLoading={isReviewing}
                      onClick={() =>
                        reviewSubmission({ status: "ACCEPTED", feedback })
                      }
                    >
                      Accept Submission
                    </CustomButton>
                  </div>
                </>
              )}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};
