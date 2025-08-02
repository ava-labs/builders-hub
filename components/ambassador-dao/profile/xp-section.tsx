import Image from "next/image";
import React from "react";
import Trophy from "@/public/ambassador-dao-images/trophy.png";
import {
  ArrowRight,
  ChevronRight,
  File,
  Hourglass,
  Lightbulb,
} from "lucide-react";
import Token from "@/public/images/usdcToken.svg";
import XP from "@/public/ambassador-dao-images/sparkles.png";

import Loader from "../ui/Loader";
import { useFetchUserXPTiers } from "@/services/ambassador-dao/requests/users";

export default function XpSection({
  data,
}: {
  data: {
    currentXP: number;
    currentTier:
      | {
          id: string;
          name: string;
          description: string;
          level: number;
          imageUrl: string;
          lowerBound: number;
          upperBound: number;
          assignedAt: string;
        }
      | undefined;
    monthlyGrowth: number;
    availableOpportunities: any[];
  };
}) {
  const { data: allTiers } = useFetchUserXPTiers();
  return (
    <div className='border rounded-lg p-4 py-6 my-6 bg-[#fff] dark:bg-[#000]'>
      <div className='mb-6 md:mb-8'>
        <div className='flex gap-4 items-center'>
          <h2 className='text-2xl font-medium'>XP Progression</h2>
          <div className='text-green-500 text-sm'>
            +{data.monthlyGrowth} XP this month
          </div>
        </div>
        <p className='text-sm text-[var(--secondary-text-color)]'>
          Your current tier is assigned by admins based on your contributions
        </p>
      </div>

      {/* <div className='mb-6'>
        <div className='flex justify-between mb-2'>
          <span className='text-sm'>Advocate</span>
          <span className='text-sm'>Ambassador</span>
        </div>
        <div className='relative h-2 bg-[#2F2F33] rounded-full'>
          {(() => {
            const currentXP = data.currentXP;
            let progressPercentage = 0;
            let tierStart = 0;
            let tierEnd = 0;

            if (currentXP <= 2000) {
              tierStart = 0;
              tierEnd = 2000;
              progressPercentage = (currentXP / tierEnd) * 100;
            } else if (currentXP <= 5000) {
              tierStart = 2001;
              tierEnd = 5000;
              progressPercentage =
                ((currentXP - tierStart) / (tierEnd - tierStart)) * 100;
            } else {
              tierStart = 5001;
              tierEnd = 100000;
              progressPercentage =
                ((currentXP - tierStart) / (tierEnd - tierStart)) * 100;
            }

            return (
              <div
                className='absolute left-0 top-0 h-full bg-[#F5F5F9] rounded-full'
                style={{
                  width: `${progressPercentage}%`,
                }}
              ></div>
            );
          })()}
        </div>
        <div className='mt-4 flex justify-between'>
          <div className='text-sm text-[var(--secondary-text-color)]'>
            {(() => {
              const currentXP = data.currentXP;

              if (currentXP <= 2000) {
                return `${2000 - currentXP} XP to Tier 2`;
              } else if (currentXP <= 5000) {
                return `${100000 - currentXP} XP to Tier 3`;
              }
            })()}
          </div>
        </div>
      </div> */}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='flex flex-col space-y-12 relative'>
          <div
            className='absolute left-4 top-4 -bottom-2 lg:bottom-1 w-0.5'
            style={{
              background: data.currentTier?.id
                ? `linear-gradient(to bottom, #EF4444 ${
                    data.currentTier.level * 33
                  }%, #D1D5DB ${data.currentTier.level * 33}%)`
                : "#D1D5DB",
            }}
          ></div>

          {!!allTiers?.tiers?.length &&
            allTiers?.tiers
              ?.sort((a, b) => a.level - b.level)
              .map((tier, index) => {
                const isActive = data?.currentTier?.level
                  ? data?.currentTier?.level >= tier.level
                  : false;
                return (
                  <div key={index} className='flex items-start relative'>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isActive ? "bg-red-500" : "bg-[#9F9FA9]"
                      } z-10`}
                    >
                      <Image src={Trophy} alt='Trophy' width={20} height={20} />
                    </div>
                    <div className='ml-4'>
                      <div
                        className={`${
                          isActive ? "text-white" : "text-[#6A7282]"
                        } text-xl font-medium`}
                      >
                        {tier.name}
                      </div>
                      <div className='text-sm text-[#6A7282]'>
                        <p>
                          {data?.currentTier?.level === tier.level
                            ? "Current Tier"
                            : data?.currentTier?.level &&
                              data?.currentTier?.level > tier.level
                            ? "Completed Tier"
                            : "Continue contributing to be considered"}
                        </p>
                        <p className='text-xs text-[#6A7282]'>
                          {tier.lowerBound.toLocaleString()} -{" "}
                          {tier.upperBound.toLocaleString()} XP
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>

        <div className='col-span-2'>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-md sm:text-xl font-medium'>
              Available Opportunities
            </h3>
            {data?.availableOpportunities?.length > 1 && (
              <a
                href='/ambassador-dao'
                className='text-xs sm:text-sm text-[var(--white-text-color)] flex items-center'
              >
                View All{" "}
                <ArrowRight size={16} color='var(--white-text-color)' />
              </a>
            )}
          </div>

          <div className='space-y-4'>
            {data.availableOpportunities &&
              data.availableOpportunities
                ?.slice(0, 2)
                ?.map((opportunity: any) => (
                  <div
                    key={opportunity.id}
                    className='bg-[#F5F5F9] dark:bg-[#000] dark:bg-opacity-50 dark:border-[#27272A] border border-[#F5F5F9 rounded-lg p-4'
                  >
                    <div className='flex flex-col sm:flex-row items-start justify-between'>
                      <div>
                        <div className='flex overflow-hidden'>
                          <img
                            src={opportunity?.created_by?.company_profile?.logo}
                            alt='Company'
                            className='w-10 h-10 object-cover bg-blue-500 rounded-full mr-3'
                          />
                          <div className='flex-1'>
                            <h4 className='text-[#FF394A] font-medium'>
                              {opportunity.title}
                            </h4>
                            <p className='text-[var(--secondary-text-color)] text-xs mb-3'>
                              {opportunity?.created_by?.company_profile?.name}
                            </p>

                            <div className='flex justify-between'>
                              <div className='flex flex-wrap items-start sm:items-center space-x-4'>
                                <div className='flex items-center text-xs text-[var(--secondary-text-color)]'>
                                  <Lightbulb
                                    size={12}
                                    className='mr-1'
                                    color='#9F9FA9'
                                  />
                                  <span className='capitalize'>
                                    {opportunity?.type?.toLowerCase()}
                                  </span>
                                </div>
                                {/* <div className='flex items-center text-xs text-[var(--secondary-text-color)]'>
                                  <Hourglass
                                    size={12}
                                    className='mr-1'
                                    color='#9F9FA9'
                                  />
                                  <span className="w-max">
                                    {getTimeLeft(opportunity?.end_date) ===
                                    "Expired"
                                      ? "Closed"
                                      : `Due in: ${getTimeLeft(
                                          opportunity?.end_date
                                        )}`}
                                  </span>
                                </div> */}
                                <div className='flex items-center text-xs text-[var(--secondary-text-color)]'>
                                  <File
                                    size={12}
                                    className='mr-1'
                                    color='#9F9FA9'
                                  />
                                  <span className='w-max'>
                                    {opportunity._count?.submissions || 0}{" "}
                                    {opportunity?._count?.submissions > 1
                                      ? "Proposals"
                                      : "Proposal"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='flex sm:flex-col space-x-3'>
                        {opportunity?.total_budget > 0 && (
                          <div className='flex items-center text-xs py-2'>
                            <Image src={Token} alt='$' />
                            <span className='text-[var(--white-text-color)] ml-2'>
                              {opportunity.total_budget} USDC
                            </span>
                          </div>
                        )}
                        {opportunity?.xp_allocated > 0 && (
                          <div className='flex items-center text-xs  py-2 rounded-full'>
                            <Image src={XP} alt='$' />
                            <span className='text-[var(--white-text-color)] ml-2'>
                              {opportunity.xp_allocated} XP
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            {!data?.availableOpportunities && <Loader />}
            {data?.availableOpportunities?.length < 1 && (
              <p className='flex justify-center items-center h-44'>
                No opportunity available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
