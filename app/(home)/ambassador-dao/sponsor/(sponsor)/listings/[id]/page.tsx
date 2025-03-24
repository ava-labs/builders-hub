"use client";
import { Outline } from "@/components/ambassador-dao/ui/Outline";
import Avalance3d from "@/public/ambassador-dao-images/3d.png";
import {
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  Hourglass,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
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
import CustomButton from "@/components/ambassador-dao/custom-button";
import {
  useFetchSingleListing,
  useFetchSingleListingApplications,
  useFetchSingleListingSubmissions,
} from "@/services/ambassador-dao/requests/sponsor";
import { useParams } from "next/navigation";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { getTimeLeft } from "@/utils/timeFormatting";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";
import { StatusBadge } from "@/components/ambassador-dao/status-badge";
import { opportunityStatusOptions } from "@/components/ambassador-dao/constants";

const AmbasssadorDaoSponsorsListingsSubmissions = () => {
  const params = useParams<{ id: string }>();

  const { data: listing, isLoading } = useFetchSingleListing(params.id);

  return (
    <div className='space-y-6'>
      <Link
        href={"/ambassador-dao/sponsor/listings"}
        className='flex items-center text-sm gap-2 p-2 cursor-pointer rounded-md w-fit bg-[#18181B] border border-[#27272A]'
      >
        <ArrowLeft color='#fff' size={16} />
        Go Back
      </Link>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          {listing && (
            <div className='border border-[#27272A] p-2 rounded-lg md:p-4 hover:border-red-500 transition-colors cursor-pointer'>
              <div className='flex flex-col md:flex-row gap-3 items-start justify-between mb-4'>
                <div className='flex md:items-center gap-3'>
                  <div>
                    <Image
                      src={listing.created_by.company_profile.logo}
                      alt='logo'
                      width={60}
                      height={60}
                      className='shrink-0'
                    />
                  </div>
                  <div>
                    <h3 className='text-lg font-medium text-red-500'>
                      {listing?.title}
                    </h3>
                    <p className='text-gray-400 font-light text-sm'>
                      {listing.created_by.company_profile.name}
                    </p>
                    <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                      <div className='flex items-center text-sm text-gray-400 capitalize'>
                        <BriefcaseBusiness
                          color='#9F9FA9'
                          className='w-3 h-3 mr-1'
                        />
                        {listing.type}
                      </div>
                      <div className='flex items-center text-sm text-gray-400'>
                        <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                        Due in {getTimeLeft(listing.end_date)}
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
                  <span className='text-white text-sm'>
                    {listing.total_budget.toLocaleString()} USDC
                  </span>
                </div>
              </div>

              <div className='flex gap-2 items-center overflow-x-auto py-2'>
                {listing.skills.map((skill, index) => (
                  <div key={index}>
                    <Outline label={skill.name} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {listing?.type === "JOB" ? (
            <JobApplications listingId={params.id} />
          ) : (
            <BountyApplications listingId={params.id} />
          )}
        </>
      )}
    </div>
  );
};

export default AmbasssadorDaoSponsorsListingsSubmissions;

const JobApplications = ({ listingId }: { listingId: string }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const limit = 10;
  const { data: listingApplications, isLoading: isLoadingApplications } =
    useFetchSingleListingApplications(
      listingId,
      debouncedQuery,
      currentPage,
      limit,
      status
    );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);
  return (
    <div className='border border-[#27272A] rounded-md p-3 md:p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h2 className='text-xl font-medium text-[#FAFAFA]'>All Applications</h2>
        <div className='flex space-x-2'>
          <Select
            defaultValue='ALL'
            onValueChange={setStatus}
            iconColor='#FAFAFA'
          >
            <SelectTrigger className='w-36 bg-[#09090B] border-[#27272A]'>
              <SelectValue placeholder='Everything' />
            </SelectTrigger>
            <SelectContent className='bg-[#27272A] border-[#27272A]'>
              {opportunityStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder='Search...'
            className='bg-[#09090B] border-[#27272A] focus:ring-[#27272A] hidden md:block'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <hr className='border-[#27272A] my-6' />

      {isLoadingApplications ? (
        <Loader />
      ) : (
        <>
          {!!listingApplications?.data?.length ? (
            <>
              {listingApplications?.data.map((application) => (
                <div
                  key={application.id}
                  className='bg-[#18181B] p-2 rounded-lg md:p-4 hover:border-black transition-colors'
                >
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
                          Applicant Name
                        </h3>
                        <p className='text-gray-400 font-light text-sm'>Role</p>
                        <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                          <div className='flex items-center text-sm text-gray-400'>
                            <Hourglass
                              color='#9F9FA9'
                              className='w-3 h-3 mr-1'
                            />
                            Submitted:{" "}
                            {new Date(
                              application.created_at
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={application.status} />
                  </div>

                  <div className='flex justify-between gap-3'>
                    <div className='flex gap-2 items-center overflow-x-auto'>
                      {application.skills.map((skill, index) => (
                        <div key={index}>
                          <Outline label={skill} />
                        </div>
                      ))}
                    </div>

                    <CustomButton className='px-3' isFullWidth={false}>
                      Details
                    </CustomButton>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <PaginationComponent
                currentPage={currentPage}
                onPageChange={handlePageChange}
                totalPages={listingApplications?.metadata.last_page ?? 1} // Replace with actual total pages from API
              />
            </>
          ) : (
            <div className='max-w-lg mx-auto p-2 my-6'>
              <Image src={Avalance3d} objectFit='contain' alt='avalance icon' />

              <div className='my-2'>
                <h2 className='text-white text-2xl text-center font-medium'>
                  No applications yet
                </h2>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const BountyApplications = ({ listingId }: { listingId: string }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const limit = 10;
  const { data: listingSubmissions, isLoading: isLoadingSubmissions } =
    useFetchSingleListingSubmissions(
      listingId,
      debouncedQuery,
      currentPage,
      limit,
      status
    );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  return (
    <div className='border border-[#27272A] rounded-md p-3 md:p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h2 className='text-xl font-medium text-[#FAFAFA]'>All Submissions</h2>
        <div className='flex space-x-2'>
          <Select
            defaultValue='ALL'
            onValueChange={setStatus}
            iconColor='#FAFAFA'
          >
            <SelectTrigger className='w-36 bg-[#09090B] border-[#27272A]'>
              <SelectValue placeholder='Everything' />
            </SelectTrigger>
            <SelectContent className='bg-[#27272A] border-[#27272A]'>
              {opportunityStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder='Search...'
            className='bg-[#09090B] border-[#27272A] focus:ring-[#27272A] hidden md:block'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <hr className='border-[#27272A] my-6' />

      {isLoadingSubmissions ? (
        <Loader />
      ) : (
        <>
          {!!listingSubmissions?.data?.length ? (
            <>
              {listingSubmissions?.data.map((submission) => (
                <div
                  key={submission.id}
                  className='bg-[#18181B] p-2 rounded-lg md:p-4 hover:border-black transition-colors'
                >
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
                          Submitter Name
                        </h3>
                        <p className='text-gray-400 font-light text-sm'>Role</p>
                        <div className='flex items-center space-x-3 mt-2 overflow-x-auto'>
                          <div className='flex items-center text-sm text-gray-400'>
                            <Hourglass
                              color='#9F9FA9'
                              className='w-3 h-3 mr-1'
                            />
                            Submitted:{" "}
                            {new Date(
                              submission.created_at
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={submission.status} />
                  </div>

                  <div className='flex justify-between gap-3'>
                    <div className='flex gap-2 items-center overflow-x-auto'>
                      {submission.skills.map((skill, index) => (
                        <div key={index}>
                          <Outline label={skill} />
                        </div>
                      ))}
                    </div>

                    <CustomButton className='px-3' isFullWidth={false}>
                      Details
                    </CustomButton>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <PaginationComponent
                currentPage={currentPage}
                onPageChange={handlePageChange}
                totalPages={listingSubmissions?.metadata.last_page ?? 1} // Replace with actual total pages from API
              />
            </>
          ) : (
            <div className='max-w-lg mx-auto p-2 my-6'>
              <Image src={Avalance3d} objectFit='contain' alt='avalance icon' />

              <div className='my-2'>
                <h2 className='text-white text-2xl text-center font-medium'>
                  No submissions yet
                </h2>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
