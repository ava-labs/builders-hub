"use client";
import {
  BountyHeader,
  BountySidebar,
  BountyDescription,
} from "@/components/ambassador-dao/bounty/components";
import CustomButton from "@/components/ambassador-dao/custom-button";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import {
  JobHeader,
  JobSidebar,
  JobDescription,
} from "@/components/ambassador-dao/jobs/components";
import { PublishOpportunityModal } from "@/components/ambassador-dao/sections/publish-opportunity-modal";
import { useFetchOpportunityDetails } from "@/services/ambassador-dao/requests/opportunity";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";

const AmbasssadorDaoSponsorsListingPreview = () => {
  const params = useParams<{ id: string }>();

  const { data, isLoading } = useFetchOpportunityDetails(params.id);

  const extractDescriptionData = (apiResponse: { description: string }) => {
    const descriptionParagraphs = apiResponse?.description
      ? apiResponse.description
          .split("\n\n")
          .filter((para) => para.trim() !== "")
      : [];
    const titleParagraph =
      descriptionParagraphs.length > 0
        ? descriptionParagraphs[0]
        : "About the Job";

    const contentParagraphs = descriptionParagraphs.slice(1);

    return {
      title: titleParagraph,
      content: contentParagraphs,
    };
  };

  const headerData = {
    id: data?.id,
    title: data?.title,
    companyName: data?.created_by?.company_profile?.name || "Unknown",
    companyLogo: data?.created_by?.company_profile?.logo,
    createdBy: `${data?.created_by?.first_name} ${data?.created_by?.last_name}`,
    type: data?.type,
    deadline: data?.end_date,
    proposalsCount: data?.max_winners || 0,
    skills: data?.skills || [],
    _count: data?._count || 0,
  };

  const sidebarData = {
    id: data?.id,
    category: data?.category,
    status: data?.status,
    total_budget: data?.total_budget || 0,
    deadline: data?.end_date,
    proposalsCount: data?._count?.submissions,
    skills: data?.skills || [],
    custom_questions: data?.custom_questions || [],
    prize_distribution: data?.prize_distribution,
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className='p-4 md:p-8 m-4 md:m-8 bg-[#09090B] border border-[#27272A] rounded-md'>
      <div className='flex justify-end mb-8'>
        <div className='flex space-x-3'>
          <Link
            href={`/ambassador-dao/sponsor/listing/${data?.id}/update?type=${data?.type}`}
          >
            <CustomButton
              variant='outlined'
              className='px-4 text-[#fff] whitespace-nowrap'
            >
              Continue Editing
            </CustomButton>
          </Link>

          {data?.status === "DRAFT" && (
            <CustomButton
              variant={"danger"}
              className='px-4'
              onClick={() => setIsModalOpen(true)}
            >
              Publish
            </CustomButton>
          )}
        </div>
      </div>

      {isLoading ? (
        <FullScreenLoader />
      ) : (
        <>
          {data && (
            <>
              {data.type === "JOB" ? (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
                  <div className='md:col-span-2 flex flex-col'>
                    <JobHeader job={headerData} />

                    <div className='block md:hidden my-6'>
                      <JobSidebar job={sidebarData} nullAction={true} />
                    </div>

                    <JobDescription data={extractDescriptionData(data)} />
                  </div>

                  <div className='hidden md:block md:col-span-1'>
                    <JobSidebar job={sidebarData} nullAction={true} />
                  </div>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
                  <div className='md:col-span-2 flex flex-col'>
                    <BountyHeader bounty={headerData} />

                    <div className='block md:hidden my-6'>
                      <BountySidebar bounty={sidebarData} nullAction={true} />
                    </div>

                    <BountyDescription data={extractDescriptionData(data)} />
                  </div>

                  <div className='hidden md:block md:col-span-1'>
                    <BountySidebar bounty={sidebarData} nullAction={true} />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {data && (
        <PublishOpportunityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
          }}
          opportunityId={data.id}
        />
      )}
    </div>
  );
};

export default AmbasssadorDaoSponsorsListingPreview;
