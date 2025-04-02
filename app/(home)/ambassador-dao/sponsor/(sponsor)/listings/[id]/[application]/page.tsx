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
          className='flex items-center text-sm gap-2 p-2 cursor-pointer rounded-md w-fit bg-[#18181B] border border-[#27272A]'
        >
          <ArrowLeft color='#fff' size={16} />
          Go Back
        </Link>

        {isLoading ? (
          <Loader />
        ) : (
          <>
            {application && (
              <div className='space-y-6'>
                <div className='border border-[#27272A] p-2 rounded-lg md:p-4 transition-colors'>
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
                        <h3 className='text-lg font-medium text-[#FAFAFA]'>
                          {application.applicant.first_name}{" "}
                          {application.applicant.last_name}
                        </h3>
                        <p className='text-[#9F9FA9] font-light text-sm'>
                          @{application.applicant.username}
                        </p>
                        <p className='text-[#9F9FA9] font-light text-sm'>
                          Based in {application.applicant.country ?? "--"}
                        </p>
                      </div>
                    </div>

                    {application.status === "APPROVED" ? (
                      <div className='flex items-center gap-2'>
                        <CustomButton
                          isFullWidth={false}
                          className='text-[#FF394A] bg-transparent border border-[#FF394A] px-4'
                          onClick={() => setIsRejectApplicantModalOpen(true)}
                        >
                          Reject Applicant
                        </CustomButton>
                        <CustomButton
                          isFullWidth={false}
                          className='text-white bg-[#FF394A] px-4'
                          onClick={() => setIsAcceptApplicantModalOpen(true)}
                        >
                          Select Applicant
                        </CustomButton>
                      </div>
                    ) : (
                      <CustomButton
                        variant='default'
                        isFullWidth={false}
                        className='px-4 bg-[#00A63E] text-white'
                        onClick={() => setIsCompleteJobModalOpen(true)}
                      >
                        Complete Job
                      </CustomButton>
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
                            <span
                              key={skill.id}
                              className='bg-[#F5F5F9] text-[#161617] px-3 py-1 rounded-full text-sm'
                            >
                              {skill.name}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className='text-2xl md:text-3xl font-medium mb-2'>
                        Socials
                      </h3>
                      <div className='flex flex-wrap gap-2'>
                        {application?.applicant?.socials?.map(
                          (social: string, index: number) => (
                            <span
                              key={index}
                              className='bg-[#F5F5F9] text-[#161617] px-3 py-1 rounded-full text-sm'
                            >
                              {social}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='border border-[#27272A] p-2 rounded-lg md:p-4 transition-colors'>
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
      />

      <AcceptApplicantModal
        isOpen={isAcceptApplicantModalOpen}
        onClose={() => setIsAcceptApplicantModalOpen(false)}
        applicantName={`${application?.applicant.first_name} ${application?.applicant.last_name}`}
        applicationId={params.application}
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
