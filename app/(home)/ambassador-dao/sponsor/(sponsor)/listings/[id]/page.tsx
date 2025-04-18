"use client";
import { Outline } from "@/components/ambassador-dao/ui/Outline";
import Avalance3d from "@/public/ambassador-dao-images/3d.png";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import {
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  Hourglass,
  Loader2,
  MessagesSquare,
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
  useExportCsv,
  useFetchSingleListing,
  useFetchSingleListingApplications,
  useFetchSingleListingSubmissions,
} from "@/services/ambassador-dao/requests/sponsor";
import { useParams } from "next/navigation";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { getTimeLeft } from "@/utils/timeFormatting";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";
import { StatusBadge } from "@/components/ambassador-dao/status-badge";
import {
  opportunityApplicationStatusOptions,
  opportunitySubmissionStatusOptions,
} from "@/components/ambassador-dao/constants";
import { SumbissionReviewDetailsModal } from "@/components/ambassador-dao/sections/submission-review-details";
import { MarkSubmissionAsPaidModal } from "@/components/ambassador-dao/sections/mark-as-paid";
import { useFetchOpportunityComment } from "@/services/ambassador-dao/requests/opportunity";
import { CommentsModal } from "@/components/ambassador-dao/sections/comments-modal";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
const AmbasssadorDaoSponsorsListingsSubmissions = () => {
  const params = useParams<{ id: string }>();

  const { data: listing, isLoading } = useFetchSingleListing(params.id);

  const { data: commentsData } = useFetchOpportunityComment(params.id, {
    page: 1,
    per_page: 10,
  });

  const [commentsModal, setCommentsModal] = useState(false);
  return (
    <div className="space-y-6">
      <Link
        href={"/ambassador-dao/sponsor/listings"}
        className="flex items-center text-sm gap-2 p-2 cursor-pointer rounded-md w-fit bg-[var(--default-background-color)] border border-[var(--default-border-color)]"
      >
        <ArrowLeft color="var(--white-text-color)" size={16} />
        Go Back
      </Link>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          {listing && (
            <div className="border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 transition-colors">
              <div className="flex flex-col md:flex-row gap-3 items-start justify-between mb-4">
                <div className="flex gap-3">
                  <div>
                    <Image
                      src={listing.created_by.company_profile.logo}
                      alt="logo"
                      width={60}
                      height={60}
                      className="shrink-0 rounded-full object-cover w-14 h-14"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-red-500">
                      {listing?.title}
                    </h3>
                    <p className="text-[var(--secondary-text-color)] font-light text-sm">
                      {listing.created_by.company_profile.name}
                    </p>
                    <div className="flex items-center space-x-3 mt-2 overflow-x-auto">
                      <div className="flex items-center text-sm text-[var(--secondary-text-color)] capitalize">
                        <BriefcaseBusiness
                          color="#9F9FA9"
                          size={14}
                          className="mr-1"
                        />
                        {listing.type.toLowerCase()}
                      </div>
                      {/* <div className='flex items-center text-sm text-[var(--secondary-text-color)]'>
                        <Hourglass color='#9F9FA9' size={14} className='mr-1' />
                        Due in {getTimeLeft(listing.end_date)}
                      </div> */}
                      <div className="flex items-center text-sm text-[var(--secondary-text-color)]">
                        <FileText color="#9F9FA9" size={14} className="mr-1" />
                        {listing.type === "JOB"
                          ? `${listing._count.applications} ${
                              listing._count.applications === 1
                                ? "Application"
                                : "Applications"
                            }`
                          : `${listing._count.submissions} ${
                              listing._count.submissions === 1
                                ? "Proposal"
                                : "Proposals"
                            }`}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Image
                    src={USDCICON}
                    alt="USDC"
                    width={20}
                    height={20}
                    className="shrink-0"
                  />
                  <span className="text-[var(--white-text-color)] text-sm">
                    {listing.total_budget.toLocaleString()} USDC
                  </span>
                </div>
              </div>

              <div className="flex gap-3 flex-col md:flex-row md:justify-between md:items-center">
                <div className="flex gap-2 items-center overflow-x-auto py-2">
                  {listing.skills.map((skill, index) => (
                    <div key={index}>
                      <Outline label={skill.name} />
                    </div>
                  ))}
                </div>
                <div>
                  {!!commentsData?.data?.length && (
                    <CustomButton
                      className="px-4 !bg-transparent border border-[var(--default-border-color)] gap-2"
                      onClick={() => {
                        setCommentsModal(true);
                      }}
                    >
                      <MessagesSquare
                        size={16}
                        color="var(--white-text-color)"
                      />
                      <p className="text-sm text-[var(--white-text-color)]">
                        Comments ({commentsData?.metadata?.total || 0})
                      </p>
                    </CustomButton>
                  )}
                </div>
              </div>
            </div>
          )}

          {listing?.type === "JOB" ? (
            <JobApplications listingId={params.id} />
          ) : (
            <BountySubmissions listingId={params.id} />
          )}
        </>
      )}

      <CommentsModal
        id={params.id}
        isOpen={commentsModal}
        onClose={() => {
          setCommentsModal(false);
        }}
      />
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

  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const { isSuccess, isLoading, isPending, error } = useExportCsv(
    exporting,
    listingId
  );

  const handleExport = () => {
    queryClient.removeQueries({ queryKey: ["exportCsv", listingId] });
    setExporting(true);
  };

  useEffect(() => {
    if (isSuccess || error) {
      setExporting(false);
    }
  }, [isSuccess, error]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);


  return (
    <div className="border border-[var(--default-border-color)] rounded-md p-3 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium text-[var(--primary-text-color)]">
          All Applications
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            className="border text-sm border-[var(--default-border-color)] bg-[var(--default-background-color)] text-[var(--primary-text-color)] rounded-md px-4 py-2 hover:bg-[var(--primary-hover-color)] transition-all duration-300 ease-in-out cursor-pointer"
            disabled={isLoading || isPending}
          >
            {isLoading || isPending ? (
              <div className="flex justify-center items-center h-5">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full opacity-50"></div>
                  <Loader2
                    className="text-[#FB2C36] w-10 h-5 animate-spin"
                    color="#FB2C36"
                  />
                </div>
              </div>
            ) : (
              "Export"
            )}
          </button>

          <Select
            defaultValue="ALL"
            onValueChange={setStatus}
            iconColor="var(--primary-text-color)"
          >
            <SelectTrigger className="w-36 bg-[var(--default-background-color)] border-[var(--default-border-color)]">
              <SelectValue placeholder="Everything" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--default-background-color)] border-[var(--default-border-color)]">
              {opportunityApplicationStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Search..."
            className="bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:ring-[#27272A] hidden md:block"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <hr className="border-[var(--default-border-color)] my-6" />

      {isLoadingApplications ? (
        <Loader />
      ) : (
        <>
          {!!listingApplications?.data?.length ? (
            <div className="space-y-4">
              {listingApplications?.data.map((application) => (
                <div
                  key={application.id}
                  className="bg-[var(--default-background-color)] border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 hover:border-black dark:hover:border-white transition-colors"
                >
                  <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
                    <div className="flex md:items-center gap-3">
                      <div>
                        <Image
                          src={
                            application.applicant.profile_image ?? DefaultAvatar
                          }
                          alt="user profile"
                          width={60}
                          height={60}
                          className="shrink-0 rounded-full object-cover w-14 h-14"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-[var(--primary-text-color)]">
                          {application.applicant.first_name}{" "}
                          {application.applicant.last_name}
                        </h3>
                        <p className="text-[var(--secondary-text-color)] font-light text-sm">
                          {" "}
                          {application.applicant.job_title ?? "--"}
                        </p>
                        <div className="flex items-center space-x-3 mt-2 overflow-x-auto">
                          <div className="flex items-center text-sm text-[var(--secondary-text-color)]">
                            <Hourglass
                              color="#9F9FA9"
                              className="w-3 h-3 mr-1"
                            />
                            Submitted:{" "}
                            {new Date(
                              application.created_at
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <StatusBadge
                      status={
                        application.status === "APPLIED"
                          ? "Pending Review"
                          : application.status ?? "N/A"
                      }
                    />
                  </div>

                  <div className="flex justify-between gap-3">
                    <div className="flex gap-2 items-center overflow-x-auto">
                      {application.applicant.skills?.map((skill, index) => (
                        <div key={index}>
                          <Outline label={skill.name} />
                        </div>
                      ))}
                    </div>

                    <Link
                      href={`/ambassador-dao/sponsor/listings/${listingId}/${application.id}`}
                    >
                      <CustomButton className="px-3" isFullWidth={false}>
                        Details
                      </CustomButton>
                    </Link>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <PaginationComponent
                currentPage={currentPage}
                onPageChange={handlePageChange}
                totalPages={listingApplications?.metadata.last_page ?? 1}
              />
            </div>
          ) : (
            <div className="max-w-lg mx-auto p-2 my-6">
              <Image src={Avalance3d} objectFit="contain" alt="avalance icon" />

              <div className="my-2">
                <h2 className="text-[var(--white-text-color)] text-2xl text-center font-medium">
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

const BountySubmissions = ({ listingId }: { listingId: string }) => {
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

  const [isOpen, setIsOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState("");
  const [submission, setSubmission] = useState<any>(null);
  const [markSubmissionAsPaidOpen, setMarkSubmissionAsPaidOpen] =
    useState(false);

    const [exporting, setExporting] = useState(false);
    const queryClient = useQueryClient();
  
    const { isSuccess, isLoading, isPending, error } = useExportCsv(
      exporting,
      listingId
    );
  
    const handleExport = () => {
      queryClient.removeQueries({ queryKey: ["exportCsv", listingId] });
      setExporting(true);
    };
  
    useEffect(() => {
      if (isSuccess || error) {
        setExporting(false);
      }
    }, [isSuccess, error]);
  

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Error while exporting");
      setExporting(false);
    }
  }, [error]);


  return (
    <div className="border border-[var(--default-border-color)] rounded-md p-3 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium text-[var(--primary-text-color)]">
          All Submissions
        </h2>
        <div className="flex space-x-2">
        <button
            onClick={handleExport}
            className="border text-sm border-[var(--default-border-color)] bg-[var(--default-background-color)] text-[var(--primary-text-color)] rounded-md px-4 py-2 hover:bg-[var(--primary-hover-color)] transition-all duration-300 ease-in-out cursor-pointer"
            disabled={isLoading || isPending}
          >
            {isLoading || isPending ? (
              <div className="flex justify-center items-center h-5">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full opacity-50"></div>
                  <Loader2
                    className="text-[#FB2C36] w-10 h-5 animate-spin"
                    color="#FB2C36"
                  />
                </div>
              </div>
            ) : (
              "Export"
            )}
          </button>

          <Select
            defaultValue="ALL"
            onValueChange={setStatus}
            iconColor="var(--primary-text-color)"
          >
            <SelectTrigger className="w-36 bg-[var(--default-background-color)] border-[var(--default-border-color)]">
              <SelectValue placeholder="Everything" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--default-background-color)] border-[var(--default-border-color)]">
              {opportunitySubmissionStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Search..."
            className="bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:ring-[#27272A] hidden md:block"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <hr className="border-[var(--default-border-color)] my-6" />

      {isLoadingSubmissions ? (
        <Loader />
      ) : (
        <>
          {!!listingSubmissions?.data?.length ? (
            <div className="space-y-4">
              {listingSubmissions?.data.map((submission) => (
                <div
                  key={submission.id}
                  className="bg-[var(--default-background-color)] border border-[var(--default-border-color)] p-2 rounded-lg md:p-4 hover:border-black dark:hover:border-white transition-colors"
                >
                  <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
                    <div className="flex md:items-center gap-3">
                      <div>
                        <Image
                          src={
                            submission.submitter.profile_image ?? DefaultAvatar
                          }
                          alt="user profile"
                          width={60}
                          height={60}
                          className="shrink-0 rounded-full object-cover w-14 h-14"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-[var(--primary-text-color)]">
                          {submission.submitter.first_name}{" "}
                          {submission.submitter.last_name}
                        </h3>
                        <p className="text-[var(--secondary-text-color)] font-light text-sm">
                          {submission.submitter.job_title ?? "--"}
                        </p>
                        <div className="flex items-center space-x-3 mt-2 overflow-x-auto">
                          <div className="flex items-center text-sm text-[var(--secondary-text-color)]">
                            <Hourglass
                              color="#9F9FA9"
                              className="w-3 h-3 mr-1"
                            />
                            Submitted:{" "}
                            {new Date(
                              submission.created_at
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <StatusBadge
                      status={
                        submission.status === "SUBMITTED"
                          ? "Pending Review"
                          : submission.status ?? "N/A"
                      }
                    />
                  </div>

                  <div className="flex justify-between gap-3">
                    <div className="flex gap-2 items-center overflow-x-auto">
                      {submission.submitter.skills?.map((skill, index) => (
                        <div key={index}>
                          <Outline label={skill.name} />
                        </div>
                      ))}
                    </div>
                    {submission.status === "ACCEPTED" ? (
                      <CustomButton
                        className="px-3"
                        isFullWidth={false}
                        onClick={() => {
                          setMarkSubmissionAsPaidOpen(true);
                          setSubmission(submission);
                        }}
                      >
                        Mark as Paid
                      </CustomButton>
                    ) : (
                      <CustomButton
                        className="px-3"
                        isFullWidth={false}
                        onClick={() => {
                          setSubmissionId(submission.id);
                          setIsOpen(true);
                        }}
                      >
                        Details
                      </CustomButton>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <PaginationComponent
                currentPage={currentPage}
                onPageChange={handlePageChange}
                totalPages={listingSubmissions?.metadata.last_page ?? 1}
              />
            </div>
          ) : (
            <div className="max-w-lg mx-auto p-2 my-6">
              <Image src={Avalance3d} objectFit="contain" alt="avalance icon" />

              <div className="my-2">
                <h2 className="text-[var(--white-text-color)] text-2xl text-center font-medium">
                  No submissions yet
                </h2>
              </div>
            </div>
          )}
        </>
      )}
      {submissionId && (
        <SumbissionReviewDetailsModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          submissionId={submissionId}
        />
      )}

      {submission && (
        <MarkSubmissionAsPaidModal
          isOpen={markSubmissionAsPaidOpen}
          onClose={() => setMarkSubmissionAsPaidOpen(false)}
          submissionId={submission.id}
          applicantName={submission.submitter.first_name}
          opportunityId={listingId}
        />
      )}
    </div>
  );
};
