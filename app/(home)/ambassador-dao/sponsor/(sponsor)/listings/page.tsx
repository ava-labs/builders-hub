"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, PenLine, Trash2, Pause } from "lucide-react";
import { Link as LinkIcon } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Avalance3d from "@/public/ambassador-dao-images/3d.png";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import CustomButton from "@/components/ambassador-dao/custom-button";
import Image from "next/image";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";
import { useFetchAllListings } from "@/services/ambassador-dao/requests/sponsor";
import {
  useFetchSponsorStatsDataQuery,
  useFetchUserDataQuery,
  useFetchUserStatsDataQuery,
} from "@/services/ambassador-dao/requests/auth";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { StatusBadge } from "@/components/ambassador-dao/status-badge";
import { DeleteOpportunityModal } from "@/components/ambassador-dao/sections/delete-opportunity-modal";
import toast from "react-hot-toast";
// Mock data
const mockUser = {
  name: "John Doe",
  since: "2025",
  image: "/avatar.png",
  stats: {
    rewarded: 0,
    listings: 0,
    submissions: 0,
  },
};

type TabType = "all" | "BOUNTY" | "JOB";

export default function AmbasssadorDaoSponsorsListingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as TabType) || "all";
  const { data: user } = useFetchUserDataQuery();
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState(tab);
  const [status, setStatus] = useState("ALL");
  const limit = 10;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null
  );

  const handleTabChange = (newTab: TabType) => {
    setType(newTab);
  };

  const { data: listings, isLoading } = useFetchAllListings(
    debouncedQuery,
    type,
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

  const { data: stats } = useFetchSponsorStatsDataQuery();

  return (
    <div className='space-y-6'>
      {/* Under review */}
      {user?.status === "PENDING" && (
        <div className='bg-[#155DFC] rounded-md p-3 md:p-6'>
          <p className='text-[var(--primary-text-color)] text-sm'>
            Under review
          </p>
          <p className='text-[var(--secondary-text-color)] text-sm font-light'>
            Your account is under review, and will be approved shortly.
          </p>
        </div>
      )}
      {/* Dashboard rejected */}
      {user?.status === "REJECTED" && (
        <div className='bg-[#FB2C36] rounded-md p-3 md:p-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between'>
          <div>
            <p className='text-[var(--primary-text-color)] text-sm'>
              Uh oh! Something went wrong.
            </p>
            <p className='text-[#E5E7EB] text-sm font-light'>
              Review and resubmit your company details again for approval.
              (TODO: Allow resubmission after admin rejection)
            </p>
          </div>
          <CustomButton
            variant='outlined'
            isFullWidth={false}
            className='font-medium px-3 whitespace-nowrap'
            onClick={() => router.push("/ambassador-dao/onboard")}
          >
            Try Again
          </CustomButton>
        </div>
      )}

      {/* User Profile */}
      <div className='border border-[var(--default-border-color)] rounded-md p-3 md:p-6'>
        <div className='flex items-center space-x-4'>
          <div className='w-12 h-12 rounded-full bg-gray-700 overflow-hidden'>
            <img
              src={user?.profile_image ?? DefaultAvatar}
              alt={user?.first_name ?? "Profile image"}
              className='w-full h-full object-cover'
            />
          </div>
          <div>
            <h2 className='text-lg font-medium text-[var(--primary-text-color)]'>
              {user?.first_name} {user?.last_name}
            </h2>
            <p className='text-sm text-[var(--secondary-text-color)] font-light'>
              Sponsor since{" "}
              {user?.created_at
                ? new Date(user?.created_at).getFullYear()
                : "--"}
            </p>
          </div>
        </div>

        <hr className='border-[var(--default-border-color)] my-8' />

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-center'>
          <StatCard
            value={stats?.total_submissions ?? 0}
            label='Submissions Received'
          />
          <StatCard
            value={stats?.total_applications ?? 0}
            label='Applications Received'
          />
          <StatCard value={stats?.total_rewards ?? 0} label='Rewarded' />
          <StatCard value={stats?.total_listings ?? 0} label='Listings' />
        </div>
      </div>
      {/* Listings Section */}
      <div className='border border-[var(--default-border-color)] rounded-md p-3 md:p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-medium text-[var(--primary-text-color)]'>
            My Listing
          </h2>
          <div className='flex space-x-2'>
            <Select
              defaultValue='ALL'
              onValueChange={setStatus}
              iconColor='var(--primary-text-color)'
            >
              <SelectTrigger className='w-36 bg-[var(--default-background-color)] border-[var(--default-border-color)]'>
                <SelectValue placeholder='Everything' />
              </SelectTrigger>
              <SelectContent className='bg-[#fafafa] dark:bg-[#09090B] border-[var(--default-border-color)]'>
                <SelectItem value='ALL'>Everything</SelectItem>
                <SelectItem value='DRAFT'>Draft</SelectItem>
                <SelectItem value='OPEN'>Open</SelectItem>
                <SelectItem value='PUBLISHED'>Published</SelectItem>
                <SelectItem value='IN_REVIEW'>In Review</SelectItem>
                <SelectItem value='COMPLETED'>Completed</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder='Search...'
              className='bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:ring-[#27272A] hidden md:block'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className='flex gap-2 whitespace-nowrap overflow-x-auto'>
          <TabButton
            active={type === "all"}
            onClick={() => handleTabChange("all")}
          >
            All
          </TabButton>
          <TabButton
            active={type === "BOUNTY"}
            onClick={() => handleTabChange("BOUNTY")}
          >
            Bounties
          </TabButton>
          <TabButton
            active={type === "JOB"}
            onClick={() => handleTabChange("JOB")}
          >
            Jobs
          </TabButton>
        </div>

        <hr className='border-[var(--default-border-color)] my-6' />

        {/* Listings Table */}
        <div className='w-full'>
          {isLoading ? (
            <Loader />
          ) : (
            <>
              {!!listings?.data?.length ? (
                <>
                  <div className='overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow className='border-[var(--default-border-color)] hover:bg-transparent whitespace-nowrap p-3 text-[var(--secondary-text-color)]'>
                          <TableHead>Listing Name</TableHead>
                          <TableHead>Submissions</TableHead>
                          {/* <TableHead>Deadline</TableHead> */}
                          <TableHead>Price</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listings?.data.map((listing) => (
                          <TableRow
                            key={listing.id}
                            className='border-[var(--default-border-color)] hover:bg-gray-200 dark:hover:bg-[#27272A]/50 whitespace-nowrap p-3 text-[var(--white-text-color)] cursor-pointer'
                            onClick={() => {
                              router.push(
                                `/ambassador-dao/sponsor/listings/${listing.id}`
                              );
                            }}
                          >
                            <TableCell className='font-medium'>
                              {listing.title}
                            </TableCell>
                            <TableCell>
                              {listing.type === "BOUNTY"
                                ? listing._count.submissions ?? "0"
                                : listing._count.applications ?? "0"}
                            </TableCell>
                            {/* <TableCell>
                              {new Date(listing.end_date).toLocaleDateString()}
                            </TableCell> */}
                            <TableCell>
                              {listing.total_budget.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={listing.status} />
                            </TableCell>
                            <TableCell className='text-right'>
                              {/* Desktop actions */}
                              <div className='hidden sm:flex justify-end space-x-2'>
                                {listing.status === "DRAFT" && (
                                  <Link
                                    href={`/ambassador-dao/sponsor/listing/${listing.id}/update?type=${listing.type}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      variant='ghost'
                                      size='sm'
                                      className='p-1 h-auto'
                                    >
                                      <PenLine
                                        className='h-4 w-4'
                                        color='#9F9FA9'
                                      />
                                    </Button>
                                  </Link>
                                )}

                                <Button
                                  variant='ghost'
                                  size='sm'
                                  className='p-1 h-auto'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedListingId(listing.id);
                                    setIsDeleteModalOpen(true);
                                  }}
                                >
                                  <Trash2 className='h-4 w-4' color='#9F9FA9' />
                                </Button>
                                {listing.status === "PUBLISHED" && (
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='p-1 h-auto'
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(
                                        `${
                                          window.location.origin
                                        }/ambassador-dao/${
                                          listing.type === "BOUNTY"
                                            ? "bounty"
                                            : "jobs"
                                        }/${listing.id}`
                                      );
                                      toast.success("Link copied to clipboard");
                                    }}
                                  >
                                    <LinkIcon
                                      className='h-4 w-4'
                                      color='#9F9FA9'
                                    />
                                  </Button>
                                )}
                                {/* <Button
                                  variant='ghost'
                                  size='sm'
                                  className='p-1 h-auto'
                                >
                                  <Pause className='h-4 w-4' color='#9F9FA9' />
                                </Button> */}
                              </div>
                              {/* Mobile dropdown */}
                              <div className='sm:hidden'>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant='ghost'
                                      size='sm'
                                      className='p-1 h-auto'
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className='h-4 w-4' />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align='end'
                                    className='bg-gray-800 border-[var(--default-border-color)]'
                                  >
                                    {listing.status === "DRAFT" && (
                                      <Link
                                        href={`/ambassador-dao/sponsor/listing/${listing.id}/update?type=${listing.type}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <DropdownMenuItem className='text-[var(--white-text-color)] hover:bg-gray-700 cursor-pointer'>
                                          <PenLine
                                            className='h-4 w-4 mr-2'
                                            color='#9F9FA9'
                                          />{" "}
                                          Edit
                                        </DropdownMenuItem>
                                      </Link>
                                    )}

                                    <DropdownMenuItem
                                      className='text-[var(--white-text-color)] hover:bg-gray-700 cursor-pointer'
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedListingId(listing.id);
                                        setIsDeleteModalOpen(true);
                                      }}
                                    >
                                      <Trash2
                                        className='h-4 w-4 mr-2'
                                        color='#9F9FA9'
                                      />{" "}
                                      Delete
                                    </DropdownMenuItem>
                                    {listing.status === "PUBLISHED" && (
                                      <DropdownMenuItem
                                        className='text-[var(--white-text-color)] hover:bg-gray-700 cursor-pointer'
                                        onClick={(e) => {
                                          e.stopPropagation();

                                          navigator.clipboard.writeText(
                                            `${
                                              window.location.origin
                                            }/ambassador-dao/${
                                              listing.type === "BOUNTY"
                                                ? "bounty"
                                                : "jobs"
                                            }/${listing.id}`
                                          );
                                          toast.success(
                                            "Link copied to clipboard"
                                          );
                                        }}
                                      >
                                        <LinkIcon
                                          className='h-4 w-4 mr-2'
                                          color='#9F9FA9'
                                        />{" "}
                                        Copy Link
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination */}
                  <PaginationComponent
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    totalPages={listings?.metadata.last_page ?? 1}
                  />
                </>
              ) : (
                <div className='max-w-lg mx-auto p-2 my-6'>
                  <Image
                    src={Avalance3d}
                    objectFit='contain'
                    alt='avalance icon'
                  />

                  <div className='my-2'>
                    <h2 className='text-[var(--white-text-color)] text-2xl text-center font-medium'>
                      Create your first listing
                    </h2>
                    <p className='text-[var(--secondary-text-color)] text-sm text-center'>
                      and start getting contributions
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedListingId && (
        <DeleteOpportunityModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          opportunityId={selectedListingId}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  value: number;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <div>
      <p className='text-2xl md:text-3xl font-semibold text-[var(--primary-text-color)]'>
        {value}
      </p>
      <p className='text-[var(--secondary-text-color)] font-light text-sm sm:text-base'>
        {label}
      </p>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 font-medium",
        active
          ? "text-white bg-red-500 rounded-md"
          : "text-[var(--secondary-text-color)] hover:text-[var(--primary-text-color)]"
      )}
    >
      {children}
    </button>
  );
}
