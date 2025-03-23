import { Outline } from "@/components/ambassador-dao/ui/Outline";
import {
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  Hourglass,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import USDCICON from "@/public/images/usdcToken.svg";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "../page";
import CustomButton from "@/components/ambassador-dao/custom-button";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";

const AmbasssadorDaoSponsorsListingsSubmissions = () => {
  return (
    <div className='space-y-6'>
      <Link
        href={"/ambassador-dao/sponsor/listings"}
        className='flex items-center text-sm gap-2 p-2 cursor-pointer rounded-md w-fit bg-[#18181B] border border-[#27272A]'
      >
        <ArrowLeft color='#fff' size={16} />
        Go Back
      </Link>

      <div className='border border-[#27272A] p-2 rounded-lg md:p-4 hover:border-red-500 transition-colors cursor-pointer'>
        <div className='flex flex-col md:flex-row gap-3 items-start justify-between mb-4'>
          <div className='flex md:items-center gap-3'>
            <div>
              <Image
                src={USDCICON}
                alt='USDC'
                width={60}
                height={60}
                className='shrink-0'
              />
            </div>
            <div>
              <h3 className='text-lg font-medium text-red-500'>
                Write a Twitter thread on Musk it project & $MUSKIT token
              </h3>
              <p className='text-gray-400 font-light text-sm'>Company Name</p>
              <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                <div className='flex items-center text-sm text-gray-400'>
                  <BriefcaseBusiness color='#9F9FA9' className='w-3 h-3 mr-1' />
                  Jobs
                </div>
                <div className='flex items-center text-sm text-gray-400'>
                  <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                  Due in 23h
                </div>
                <div className='flex items-center text-sm text-gray-400'>
                  <FileText color='#9F9FA9' className='w-3 h-3 mr-1' />
                  60 Proposals
                </div>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Image
              src={USDCICON}
              alt='USDC'
              width={20}
              height={20}
              className='shrink-0'
            />
            <span className='text-white text-sm'>1000 USDC</span>
          </div>
        </div>

        <div className='flex gap-2 items-center overflow-x-auto py-2'>
          {Array(5)
            .fill(0)
            .map((_, index) => (
              <div key={index}>
                <Outline label='Outline' />
              </div>
            ))}
        </div>
      </div>

      <div className='border border-[#27272A] rounded-md p-3 md:p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-medium text-[#FAFAFA]'>
            All Applications
          </h2>
          <div className='flex space-x-2'>
            <Select defaultValue='everything'>
              <SelectTrigger className='w-36 bg-[#09090B] border-[#27272A]'>
                <SelectValue placeholder='Everything' />
              </SelectTrigger>
              <SelectContent className='bg-[#27272A] border-[#27272A]'>
                <SelectItem value='everything'>Everything</SelectItem>
                <SelectItem value='draft'>Draft</SelectItem>
                <SelectItem value='live'>Live</SelectItem>
                <SelectItem value='in-review'>In Review</SelectItem>
                <SelectItem value='recent'>Payment Pending</SelectItem>
                <SelectItem value='complete'>Complete</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder='Search...'
              className='bg-[#09090B] border-[#27272A] focus:ring-[#27272A] hidden md:block'
            />
          </div>
        </div>
        <hr className='border-[#27272A] my-6' />

        <div className='bg-[#18181B] p-2 rounded-lg md:p-4 hover:border-black transition-colors'>
          <div className='flex flex-col md:flex-row gap-3 items-center justify-between mb-4'>
            <div className='flex md:items-center gap-3'>
              <div>
                <Image
                  src={USDCICON}
                  alt='USDC'
                  width={60}
                  height={60}
                  className='shrink-0'
                />
              </div>
              <div>
                <h3 className='text-lg font-medium text-white'>
                  Andro Strassmann
                </h3>
                <p className='text-gray-400 font-light text-sm'>
                  Web Developer
                </p>
                <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                  <div className='flex items-center text-sm text-gray-400'>
                    <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                    Submitted: 2025-02-13
                  </div>
                </div>
              </div>
            </div>

            <StatusBadge status='Pending Reviews' />
          </div>

          <div className='flex justify-between gap-3'>
            <div className='flex gap-2 items-center overflow-x-auto'>
              {Array(5)
                .fill(0)
                .map((_, index) => (
                  <div key={index}>
                    <Outline label='Outline' />
                  </div>
                ))}
            </div>

            <CustomButton className='px-3' isFullWidth={false}>
              Details
            </CustomButton>
          </div>
        </div>

        <PaginationComponent />
      </div>
    </div>
  );
};

export default AmbasssadorDaoSponsorsListingsSubmissions;
