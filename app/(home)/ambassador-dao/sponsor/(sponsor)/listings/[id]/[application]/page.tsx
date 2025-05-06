"use client";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { useFetchSingleListingApplication } from "@/services/ambassador-dao/requests/sponsor";
import { ArrowLeft, Hourglass, Link as LinkIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import CustomButton from "@/components/ambassador-dao/custom-button";
import { RejectApplicantModal } from "@/components/ambassador-dao/sections/reject-applicant";
import { AcceptApplicantModal } from "@/components/ambassador-dao/sections/accept-applicant";
import { CompleteJobModal } from "@/components/ambassador-dao/sections/complete-job";

const AmbasssadorDaoSingleApplicationPage = () => {
  const params = useParams<{ id: string; application: string }>();

  const { data: application, isLoading } = useFetchSingleListingApplication(
    params.id,
    params.application
  );

  const [isRejectApplicantModalOpen, setIsRejectApplicantModalOpen] =
    useState(false);
  const [isAcceptApplicantModalOpen, setIsAcceptApplicantModalOpen] =
    useState(false);
  const [isCompleteJobModalOpen, setIsCompleteJobModalOpen] = useState(false);
  return (
    <>
      <div className='space-y-6'>
        <Link
          href={`/ambassador-dao/sponsor/listings/${params.id}`}
          className='flex items-center text-sm gap-2 p-2 cursor-pointer rounded-md w-fit bg-[var(--default-background-color)] border border-[var(--default-border-color)]'
        >
          <ArrowLeft color='var(--white-text-color)' size={16} />
          Go Back
        </Link>

        {isLoading ? (
          <Loader />
        ) : (
          <>
            {application && (
              <div className='space-y-6'>
                <div className='border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 transition-colors'>
                  <div className='flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4'>
                    <div className='flex md:items-center gap-3'>
                      <div>
                        <Image
                          src={
                            application.applicant.profile_image ?? DefaultAvatar
                          }
                          alt='logo'
                          width={40}
                          height={40}
                          className='shrink-0 rounded-full object-cover w-14 h-14'
                        />
                      </div>
                      <div>
                        <h3 className='text-lg font-medium text-[var(--primary-text-color)]'>
                          {application.applicant.first_name}{" "}
                          {application.applicant.last_name}{" "}
                          <span className='text-[var(--secondary-text-color)] font-light text-sm'>
                            ( @{application.applicant.username})
                          </span>
                        </h3>
                        <div className='flex items-center space-x-3 overflow-x-auto'>
                          <div className='flex items-center text-sm text-[var(--secondary-text-color)]'>
                            <Hourglass
                              color='#9F9FA9'
                              className='w-3 h-3 mr-1'
                            />
                            Submitted:{" "}
                            {new Date(
                              application.created_at
                            ).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(
                              application.created_at
                            ).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {application.status === "APPROVED" ? (
                      <CustomButton
                        isFullWidth={false}
                        className='px-4 bg-green-600 text-white'
                        onClick={() => setIsCompleteJobModalOpen(true)}
                      >
                        Complete Job
                      </CustomButton>
                    ) : (
                      <>
                        {application.status !== "REJECTED" &&
                          application.status !== "COMPLETED" && (
                            <div className='flex items-center gap-2'>
                              <CustomButton
                                isFullWidth={false}
                                className='!text-[#FF394A] !bg-transparent border !border-[#FF394A] px-4'
                                onClick={() =>
                                  setIsRejectApplicantModalOpen(true)
                                }
                              >
                                Reject Applicant
                              </CustomButton>
                              <CustomButton
                                isFullWidth={false}
                                className='!text-[#fff] !bg-[#FF394A] px-4'
                                onClick={() =>
                                  setIsAcceptApplicantModalOpen(true)
                                }
                              >
                                Select Applicant
                              </CustomButton>
                            </div>
                          )}
                      </>
                    )}
                  </div>

                  <hr className='my-4 md:my-8' />

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
                    <div className=''>
                      <p className='text-[var(--primary-text-color)] font-semibold'>
                        Based in
                      </p>
                      <p className='text-[var(--secondary-text-color)] text-sm'>
                        {application.applicant.location ?? "--"}
                      </p>
                    </div>
                    <div className=''>
                      <p className='text-[var(--primary-text-color)] font-semibold'>
                        Experience
                      </p>
                      <p className='text-[var(--secondary-text-color)] text-sm'>
                        {application.applicant.years_of_experience ?? "--"}{" "}
                        years
                      </p>
                    </div>

                    <div className=''>
                      <p className='text-[var(--primary-text-color)] font-semibold'>
                        Completed Jobs
                      </p>
                      <p className='text-[var(--secondary-text-color)] text-sm'>
                        {application.applicant_number_of_completed_jobs ?? "--"}
                      </p>
                    </div>
                  </div>

                  <hr className='my-4 md:my-8' />

                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                    <div>
                      <h3 className='text-2xl md:text-3xl font-medium mb-2'>
                        Skills
                      </h3>
                      <div className='flex flex-wrap gap-2'>
                        {application?.applicant?.skills?.map(
                          (skill: { name: string; id: string }) => (
                            <div
                              key={skill.id}
                              className='capitalize text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)]'
                            >
                              {skill.name}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className='text-2xl md:text-3xl font-medium mb-2'>
                        Socials
                      </h3>
                      <div className='flex flex-wrap gap-2'>
                        {application?.applicant?.social_links?.map(
                          (social: string, index: number) => (
                            <a
                              key={index}
                              href={social}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)]'
                            >
                              {social.slice(0, 20)}...
                            </a>
                          )
                        )}
                        {application.telegram_username && (
                          <a
                            href={application.telegram_username}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)]'
                          >
                            Telegram:{" "}
                            {application.telegram_username.slice(0, 20)}...
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 transition-colors'>
                  <h3 className='text-3xl font-medium mb-2'>Application</h3>
                  <hr className='my-4 md:my-6' />

                  <div className='space-y-3 md:space-y-5'>
                    <div>
                      <p className='text-[var(--primary-text-color)] text-lg font-medium'>
                        Application Details
                      </p>
                      <p className='text-[var(--secondary-text-color)]'>
                        {application.cover_letter ?? "--"}
                      </p>
                    </div>

                    <div>
                      <p className='text-[var(--primary-text-color)] text-lg font-medium'>
                        Attachments
                      </p>
                      <div className='space-y-3 mt-2'>
                        {!application.files.length && (
                          <div className='text-[var(--secondary-text-color)] text-sm'>
                            No files uploaded
                          </div>
                        )}
                        {application.files.map((file) => (
                          <div className='flex flex-col md:flex-row gap-2 justify-between border border-[var(--default-border-color)] p-2 rounded-md my-1'>
                            <div className='flex gap-2 items-center'>
                              <LinkIcon
                                size={16}
                                color='var(--primary-text-color'
                              />
                              <p className='font-semibold text-[var(--primary-text-color)]'>
                                {file.original_name}
                              </p>
                            </div>
                            <p className='text-[var(--primary-text-color)] font-semibold cursor-pointer'>
                              <a
                                href={`https://s3.eu-west-2.amazonaws.com/ambassador-dao-public-assets/${file.path}`}
                                target='_blank'
                                rel='noopener noreferrer'
                              >
                                Download
                              </a>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {application.extra_data && (
                      <div>
                        <p className='text-[var(--primary-text-color)] text-lg font-medium'>
                          Extra data
                        </p>
                        <p className='text-[var(--secondary-text-color)]'>
                          {application.extra_data}
                        </p>
                      </div>
                    )}

                    {!!application.custom_answers.length && (
                      <div>
                        <p className='text-[var(--primary-text-color)] text-lg font-medium'>
                          Answers to Questions
                        </p>
                        <div className='space-y-3 mt-2'>
                          {application.custom_answers.map(
                            (answer: { question: string; answer: string }) => (
                              <div className=' border border-[var(--default-border-color)] p-2 rounded-md'>
                                <p className='text-[var(--primary-text-color)] font-semibold'>
                                  {answer.question}
                                </p>
                                <p className='text-[var(--secondary-text-color)]'>
                                  {answer.answer}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* <div className='border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 transition-colors'>
                  <h3 className='text-3xl font-medium mb-2'>Portfolio</h3>
                  <hr className='my-4 md:my-6' />

                  <p className='text-grey-600'>
                    TODO: Figure out how to show portfolio
                  </p>
                </div> */}
              </div>
            )}
          </>
        )}
      </div>

      <RejectApplicantModal
        isOpen={isRejectApplicantModalOpen}
        onClose={() => setIsRejectApplicantModalOpen(false)}
        applicantName={`${application?.applicant.first_name} ${application?.applicant.last_name}`}
        applicationId={params.application}
        opportunityId={params.id}
      />

      <AcceptApplicantModal
        isOpen={isAcceptApplicantModalOpen}
        onClose={() => setIsAcceptApplicantModalOpen(false)}
        applicantName={`${application?.applicant.first_name} ${application?.applicant.last_name}`}
        applicationId={params.application}
        opportunityId={params.id}
      />

      {application && (
        <CompleteJobModal
          isOpen={isCompleteJobModalOpen}
          onClose={() => setIsCompleteJobModalOpen(false)}
          applicationId={params.application}
          opportunityId={params.id}
          applicantName={`${application?.applicant.first_name} ${application?.applicant.last_name}`}
        />
      )}
    </>
  );
};

export default AmbasssadorDaoSingleApplicationPage;
