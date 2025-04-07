import Image from "next/image";
import React from "react";
import Trophy from "@/public/ambassador-dao-images/trophy.png";
import { ChevronRight, File, Hourglass, Lightbulb } from "lucide-react";
import Token from "@/public/ambassador-dao-images/token.png";
import XP from "@/public/ambassador-dao-images/sparkles.png";

import Loader from "../ui/Loader";
import { getTimeLeft } from "@/utils/timeFormatting";

export default function XpSection({ data }: any) {
  return (
    <div className='border rounded-lg p-6 mb-6 bg-[#fff] dark:bg-[#000]'>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-2xl font-bold'>XP Progression</h2>
        <div className='text-green-500 text-sm'>
          +{data.monthlyGrowth} XP this month
        </div>
      </div>

      <div className='mb-6'>
        <div className='flex justify-between mb-2'>
          <span className='text-sm'>Advocate</span>
          <span className='text-sm'>Ambassador</span>
        </div>
        <div className='relative h-2 bg-gray-800 rounded-full'>
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
                className='absolute left-0 top-0 h-full bg-red-500 rounded-full'
                style={{
                  width: `${progressPercentage}%`,
                }}
              ></div>
            );
          })()}
        </div>
        <div className='mt-2 flex justify-between'>
          <div className='text-xl font-bold'>{data.currentXP} XP</div>
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
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='flex flex-col space-y-12 lg:space-y-13 relative'>
          <div
            className='absolute left-4 top-4 -bottom-2 lg:bottom-1 w-0.5 bg-gradient-to-b from-red-500 via-red-500 to-gray-700'
            style={{
              transform: "translateX(-50%)",
              background: (() => {
                const currentXP = data.currentXP;

                if (currentXP <= 2000) {
                  return "linear-gradient(to bottom, #ef4444 0%, #ef4444 0%, #D1D5DB 0%, #D1D5DB 100%)";
                } else if (currentXP <= 5000) {
                  return "linear-gradient(to bottom, #ef4444 0%, #ef4444 55%, #D1D5DB 45%, #D1D5DB 100%)";
                } else {
                  return "linear-gradient(to bottom, #ef4444 0%, #ef4444 100%)";
                }
              })(),
            }}
          ></div>

          <div className='flex items-center relative'>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                data.currentXP >= 0 ? "bg-red-500" : "bg-[#9F9FA9]"
              } z-10`}
            >
              <Image src={Trophy} alt='Trophy' width={20} height={20} />
            </div>
            <div className='ml-4'>
              <div
                className={`${
                  data.currentXP >= 0 ? " text-white" : " text-[#6A7282]"
                } text-xl font-medium`}
              >
                Tier 1: Chill 001
              </div>
              <div className='text-sm text-[#6A7282]'>0-2000 XP</div>
            </div>
          </div>

          <div className='flex items-center relative'>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                data.currentXP > 2000 ? "bg-red-500" : "bg-[#9F9FA9]"
              } z-10`}
            >
              <Image src={Trophy} alt='Trophy' width={20} height={20} />
            </div>
            <div className='ml-4'>
              <div
                className={`${
                  data.currentXP > 2000 ? " text-white" : " text-[#6A7282]"
                } font-medium text-xl`}
              >
                Tier 2: Snr Chiller
              </div>
              <div className='text-sm text-[#6A7282]'>2001-5000 XP</div>
            </div>
          </div>

          <div className='flex items-center relative'>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                data.currentXP > 5000 ? "bg-red-500" : "bg-[#9F9FA9]"
              } z-10`}
            >
              <Image src={Trophy} alt='Trophy' width={20} height={20} />
            </div>
            <div className='ml-4'>
              <div
                className={`${
                  data.currentXP > 5000 ? " text-white" : " text-[#6A7282]"
                } text-xl font-medium`}
              >
                Tier 3: Supreme Leader
              </div>
              <div className='text-sm text-[#6A7282]'>5001-100000 XP</div>
            </div>
          </div>
        </div>

        <div className='col-span-2'>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-xl font-medium'>Available Opportunities</h3>
            {data?.availableOpportunities?.length > 1 && (
              <a
                href='/ambassador-dao'
                className='text-sm text-red-500 flex items-center'
              >
                View All <ChevronRight size={16} />
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
                    className='bg-[#161617] rounded-lg p-4'
                  >
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex overflow-hidden'>
                          <img
                            src={opportunity?.created_by?.company_profile?.logo}
                            alt='Company'
                            className='w-10 h-10 object-cover bg-blue-500 rounded-full mr-3'
                          />
                          <div className='flex-1'>
                            <h4 className='text-red-500 font-bold'>
                              {opportunity.title}
                            </h4>
                            <p className='text-[var(--secondary-text-color)] text-xs mb-3'>
                              {opportunity?.created_by?.company_profile?.name}
                            </p>

                            <div className='flex justify-between'>
                              <div className='flex items-center space-x-4'>
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
                                <div className='flex items-center text-xs text-[var(--secondary-text-color)]'>
                                  <Hourglass
                                    size={12}
                                    className='mr-1'
                                    color='#9F9FA9'
                                  />
                                  <span>
                                    {getTimeLeft(opportunity?.end_date) ===
                                    "Expired"
                                      ? "Closed"
                                      : `Due in: ${getTimeLeft(
                                          opportunity?.end_date
                                        )}`}
                                  </span>
                                </div>
                                <div className='flex items-center text-xs text-[var(--secondary-text-color)]'>
                                  <File
                                    size={12}
                                    className='mr-1'
                                    color='#9F9FA9'
                                  />
                                  <span>
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

                      <div className='flex flex-col space-x-3'>
                        <div className='flex items-center text-xs py-2'>
                          <Image src={Token} alt='$' />
                          <span className='text-[var(--white-text-color)] ml-2'>
                            {opportunity.total_budget} USDC
                          </span>
                        </div>
                        <div className='flex items-center text-xs  py-2 rounded-full'>
                          <Image src={XP} alt='$' />
                          <span className='text-[var(--white-text-color)] ml-2'>
                            {opportunity.xp_allocated} XP
                          </span>
                        </div>
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
