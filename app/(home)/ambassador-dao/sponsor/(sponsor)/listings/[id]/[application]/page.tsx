"use client";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { useFetchSingleListingApplication } from "@/services/ambassador-dao/requests/sponsor";
import { ArrowLeft } from "lucide-react";
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
                          {application.applicant.last_name}
                        </h3>
                        <p className='text-[var(--secondary-text-color)] font-light text-sm'>
                          @{application.applicant.username}
                        </p>
                        <p className='text-[var(--secondary-text-color)] font-light text-sm'>
                          Based in {application.applicant.location ?? "--"}
                        </p>
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
                      <div className='flex items-center gap-2'>
                        <CustomButton
                          isFullWidth={false}
                          className='!text-[#FF394A] !bg-transparent border !border-[#FF394A] px-4'
                          onClick={() => setIsRejectApplicantModalOpen(true)}
                        >
                          Reject Applicant
                        </CustomButton>
                        <CustomButton
                          isFullWidth={false}
                          className='!text-[#fff] !bg-[#FF394A] px-4'
                          onClick={() => setIsAcceptApplicantModalOpen(true)}
                        >
                          Select Applicant
                        </CustomButton>
                      </div>
                    )}
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
                              className='text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)]'
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
                            <div
                              key={index}
                              className='text-xs px-2 py-1 rounded-full text-center border border-[var(--default-border-color)]'
                            >
                              {social.slice(0, 20)}...
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 transition-colors'>
                  <h3 className='text-3xl font-medium mb-2'>Portfolio</h3>
                  <hr className='my-4 md:my-8' />

                  <p className='text-grey-600'>
                    TODO: Figure out how to show portfolio
                  </p>
                </div>
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
