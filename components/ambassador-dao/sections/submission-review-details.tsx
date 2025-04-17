import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ambassador-dao/dialog";
import CustomButton from "../custom-button";
import {
  useFetchSingleListingSubmission,
  useFetchUnclaimedRewards,
  useRejectSubmissionMutation,
  useUpdateBountyRewardMutation,
} from "@/services/ambassador-dao/requests/sponsor";
import CustomInput from "../input";
import Loader from "../ui/Loader";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import Image from "next/image";
import { Hourglass, Link } from "lucide-react";
import { useFetchUserStatsDataQuery } from "@/services/ambassador-dao/requests/auth";
import CustomSelect from "../select";
import { Outline } from "../ui/Outline";

interface IDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  submissionId: string;
}

type ActionType = "NONE" | "ACCEPT" | "REJECT";

export const SumbissionReviewDetailsModal = ({
  isOpen,
  onClose,
  submissionId,
}: IDeleteProps) => {
  const [selectedAction, setSelectedAction] = useState<ActionType>("NONE");
  const [feedback, setFeedback] = useState("");
  const [rewardId, setRewardId] = useState<string>("");

  const { data: submission, isLoading } =
    useFetchSingleListingSubmission(submissionId);

  const { data: userStats } = useFetchUserStatsDataQuery(
    submission?.submitter.username
  );

  const { data: unclaimedRewards } = useFetchUnclaimedRewards(
    submission?.opportunity.id
  );

  const { mutate: rejectSubmission, isPending: isRejecting } =
    useRejectSubmissionMutation(submissionId);

  const { mutateAsync: updateBountyReward, isPending: isUpdatingBounty } =
    useUpdateBountyRewardMutation();

  const handleContinue = async () => {
    if (selectedAction === "ACCEPT" && rewardId) {
      await updateBountyReward({
        submissionId: submission!.id,
        opportunityId: submission!.opportunity.id,
        rewardId: rewardId,
      });
      onClose();
    } else if (selectedAction === "REJECT" && feedback) {
      rejectSubmission({ status: "REJECTED", feedback });
      onClose();
    }
  };

  const resetForm = () => {
    setSelectedAction("NONE");
    setFeedback("");
    setRewardId("");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
        }
        onClose();
      }}
    >
      <DialogContent
        className='max-w-2xl py-6 bg-[#fafafa] dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle className='text-2xl text-[var(--primary-text-color)] font-semibold'>
          Submission Details
        </DialogTitle>
        <div className='text-[var(--secondary-text-color)] my-3'>
          Review the details of this submission before making a decision.
        </div>

        <hr className='my-4 md:my-6' />

        {isLoading ? (
          <Loader />
        ) : (
          submission && (
            <div className='space-y-6 md:space-y-8'>
              <div className='bg-gray-100 dark:bg-[#18181B] border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 hover:border-black transition-colors'>
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
                        className='shrink-0 rounded-full object-cover w-14 h-14'
                      />
                    </div>
                    <div>
                      <h3 className='text-lg font-medium text-[var(--primary-text-color)]'>
                        {submission.submitter.job_title ?? "--"}
                      </h3>
                      <p className='text-[var(--secondary-text-color)] font-light text-sm'>
                        {submission.submitter.first_name}{" "}
                        {submission.submitter.last_name}
                      </p>
                      <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                        <div className='flex items-center text-sm text-[var(--secondary-text-color)]'>
                          <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                          Submitted:{" "}
                          {new Date(submission.created_at).toLocaleDateString()}
                          at{" "}
                          {new Date(submission.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <CustomButton
                    className='px-2 bg-[#fb2c36e9] dark:bg-[#FB2C3633] text-[#fff] dark:text-[#FB2C36]'
                    isFullWidth={false}
                  >
                    Contributor
                  </CustomButton>
                </div>
              </div>

              <div>
                <p className='text-[var(--primary-text-color)] font-semibold'>
                  Skills
                </p>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {submission.submitter.skills.map((skill) => (
                    <div
                      className='text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)]'
                      key={skill.id}
                    >
                      {skill.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
                <div className=''>
                  <p className='text-[var(--primary-text-color)] font-semibold'>
                    Experience
                  </p>
                  <p className='text-[var(--secondary-text-color)] text-sm'>
                    {submission.submitter.years_of_experience ?? "--"} years
                  </p>
                </div>
                <div className=''>
                  <p className='text-[var(--primary-text-color)] font-semibold'>
                    Success Rate
                  </p>
                  <p className='text-[var(--secondary-text-color)] text-sm'>
                    --%
                  </p>
                </div>
                <div className=''>
                  <p className='text-[var(--primary-text-color)] font-semibold'>
                    Completed Jobs
                  </p>
                  <p className='text-[var(--secondary-text-color)] text-sm'>
                    --
                  </p>
                </div>
              </div>

              <div className='space-y-3'>
                <div>
                  <p className='text-[var(--primary-text-color)] font-semibold'>
                    Submission Details
                  </p>
                  <p className='text-[var(--secondary-text-color)]'>
                    {submission.content}
                  </p>
                </div>

                {submission.link && (
                  <div>
                    <p className='text-[var(--primary-text-color)] font-semibold'>
                      Link to submission
                    </p>
                    <a
                      href={submission.link}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='mt-2'
                    >
                      <Outline label={`${submission.link.slice(0, 40)}...`} />
                    </a>
                  </div>
                )}

                <div>
                  <p className='text-[var(--primary-text-color)] font-medium'>
                    Attachments
                  </p>
                  <div className='space-y-3 mt-2'>
                    {!submission.files.length && (
                      <div className='text-[var(--secondary-text-color)] text-sm'>
                        No files uploaded
                      </div>
                    )}
                    {submission.files.map((file) => (
                      <div className='flex flex-col md:flex-row gap-2 justify-between border border-[var(--default-border-color)] p-2 rounded-md my-1'>
                        <div className='flex gap-2 items-center'>
                          <Link size={16} color='var(--primary-text-color' />
                          <p className='font-semibold text-[var(--primary-text-color)]'>
                            {file.original_name}
                          </p>
                        </div>
                        <p className='text-[var(--primary-text-color)] font-semibold cursor-pointer'>
                          Download
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {submission.tweet_link && (
                  <div>
                    <p className='text-[var(--primary-text-color)] font-semibold'>
                      Tweet Link
                    </p>
                    <a
                      href={submission.tweet_link}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='mt-2'
                    >
                      <Outline
                        label={`${submission.tweet_link.slice(0, 40)}...`}
                      />
                    </a>
                  </div>
                )}
              </div>

              {selectedAction === "NONE" && (
                <>
                  {" "}
                  {submission.status !== "ACCEPTED" &&
                    submission.status !== "REJECTED" && (
                      <div className='flex gap-2 justify-between mt-6 md:mt-8'>
                        <CustomButton
                          variant='outlined'
                          className='px-4 w-full'
                          onClick={() => setSelectedAction("REJECT")}
                        >
                          Reject Submission
                        </CustomButton>

                        <CustomButton
                          variant='danger'
                          className='px-4 w-full'
                          onClick={() => setSelectedAction("ACCEPT")}
                        >
                          Accept Submission
                        </CustomButton>
                      </div>
                    )}
                </>
              )}

              {selectedAction === "ACCEPT" && (
                <div className='space-y-4'>
                  <CustomSelect
                    id='winner'
                    label='Select Winner Position'
                    value={rewardId}
                    onChange={(e) => setRewardId(e.target.value)}
                  >
                    <option value=''>Select position</option>
                    {unclaimedRewards?.map((reward, idx) => (
                      <option value={reward.id} key={idx}>
                        {reward.position === 1
                          ? `First Prize ($${reward.amount})`
                          : reward.position === 2
                          ? `Second Prize ($${reward.amount})`
                          : reward.position === 3
                          ? `Third Prize ($${reward.amount})`
                          : `${reward.position}th Prize ($${reward.amount})`}
                      </option>
                    ))}
                  </CustomSelect>
                  <div className='flex gap-2 mt-3'>
                    <CustomButton
                      variant='outlined'
                      className='px-4'
                      onClick={() => setSelectedAction("NONE")}
                    >
                      Back
                    </CustomButton>
                    <CustomButton
                      variant='danger'
                      className='px-4'
                      disabled={!rewardId}
                      isLoading={isUpdatingBounty}
                      onClick={handleContinue}
                    >
                      Continue
                    </CustomButton>
                  </div>
                </div>
              )}

              {selectedAction === "REJECT" && (
                <div className='space-y-4'>
                  <div>
                    <CustomInput
                      label='Feedback'
                      placeholder='Enter feedback'
                      name='feedback'
                      type='text'
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                    <div className='text-[var(--secondary-text-color)] text-xs mt-2'>
                      Please provide feedback for the applicant. This will be
                      sent to the applicant.
                    </div>
                  </div>
                  <div className='flex gap-2 mt-3'>
                    <CustomButton
                      variant='outlined'
                      className='px-4'
                      onClick={() => setSelectedAction("NONE")}
                    >
                      Back
                    </CustomButton>
                    <CustomButton
                      variant='danger'
                      className='px-4'
                      disabled={!feedback}
                      isLoading={isRejecting}
                      onClick={handleContinue}
                    >
                      Continue
                    </CustomButton>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};
