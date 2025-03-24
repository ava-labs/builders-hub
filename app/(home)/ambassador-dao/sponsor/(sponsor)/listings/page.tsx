"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, PenLine, Trash2, Link, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Avalance3d from "@/public/ambassador-dao-images/3d.png";
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
  useFetchUserDataQuery,
  useFetchUserStatsDataQuery,
} from "@/services/ambassador-dao/requests/auth";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { StatusBadge } from "@/components/ambassador-dao/status-badge";

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
  const [username, setUsername] = useState(user?.username);
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState(tab);
  const [status, setStatus] = useState("ALL");
  const limit = 10;

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

  const { data: stats, refetch } = useFetchUserStatsDataQuery(username);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    refetch();
  }, [user]);

  useEffect(() => {
    if (!username) return;
    console.log(username);
    refetch();
  }, [username]);

  return (
    <div className='space-y-6'>
      {/* Under review */}
      <div className='bg-[#155DFC] rounded-md p-3 md:p-6'>
        <p className='text-[#FAFAFA] text-sm'>Under review</p>
        <p className='text-[#9F9FA9] text-sm font-light'>
          Lorem ipsum dolor sit amet,consectetur adipiscing elit.{" "}
        </p>
      </div>{" "}
      {/* Dashboard rejected */}
      <div className='bg-[#FB2C36] rounded-md p-3 md:p-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between'>
        <div>
          <p className='text-[#FAFAFA] text-sm'>Uh oh! Something went wrong.</p>
          <p className='text-[#E5E7EB] text-sm font-light'>
            Review and resubmit your company details for approval
          </p>
        </div>
        <CustomButton
          variant='outlined'
          isFullWidth={false}
          className='font-medium px-3 whitespace-nowrap'
        >
          Try Again
        </CustomButton>
      </div>
      {/* User Profile */}
      <div className='border border-[#27272A] rounded-md p-3 md:p-6'>
        <div className='flex items-center space-x-4'>
          <div className='w-12 h-12 rounded-full bg-gray-700 overflow-hidden'>
            <img
              src={user?.profile_image ?? ""}
              alt={user?.first_name ?? "Profile image"}
              className='w-full h-full object-cover'
            />
          </div>
          <div>
            <h2 className='text-lg font-medium text-[#F8FAFC]'>
              {user?.first_name} {user?.last_name}
            </h2>
            <p className='text-sm text-[#9F9FA9] font-light'>
              Sponsor since 2025
            </p>
          </div>
        </div>

        <hr className='border-[#27272A] my-8' />

        <div className='grid grid-cols-3 gap-4 text-center'>
          <StatCard value={mockUser.stats.rewarded} label='Rewarded' />
          <StatCard value={mockUser.stats.listings} label='Listings' />
          <StatCard value={mockUser.stats.submissions} label='Submissions' />
        </div>
      </div>
      {/* Listings Section */}
      <div className='border border-[#27272A] rounded-md p-3 md:p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-medium text-[#FAFAFA]'>My Listing</h2>
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
                <SelectItem value='ALL'>Everything</SelectItem>
                <SelectItem value='DRAFT'>Draft</SelectItem>
                <SelectItem value='OPEN'>Open</SelectItem>
                <SelectItem value='IN_REVIEW'>In Review</SelectItem>
                <SelectItem value='in-COMPLETED'>Completed</SelectItem>
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

        <hr className='border-[#27272A] my-6' />

        {/* Listings Table */}
        <div className='w-full'>
          {isLoading ? (
            <Loader />
          ) : (
            <>
              {!!listings?.data?.length ? (
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow className='border-[#27272A] hover:bg-transparent whitespace-nowrap p-3 text-[#9F9FA9]'>
                        <TableHead>Listing Name</TableHead>
                        <TableHead>Submissions</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className='text-right'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listings?.data.map((listing) => (
                        <TableRow
                          key={listing.id}
                          className='border-gray-800 hover:bg-[#27272A]/50 whitespace-nowrap p-3 text-white cursor-pointer'
                          onClick={() => {
                            router.push(
                              `/ambassador-dao/sponsor/listings/${listing.id}`
                            );
                          }}
                        >
                          <TableCell className='font-medium'>
                            {listing.title}
                          </TableCell>
                          <TableCell>"Not Returned"</TableCell>
                          <TableCell>
                            {new Date(listing.end_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {listing.total_budget.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={listing.status} />
                          </TableCell>
                          <TableCell className='text-right'>
                            {/* Desktop actions */}
                            <div className='hidden sm:flex justify-end space-x-2'>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='p-1 h-auto'
                              >
                                <PenLine className='h-4 w-4' color='#9F9FA9' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='p-1 h-auto'
                              >
                                <Trash2 className='h-4 w-4' color='#9F9FA9' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='p-1 h-auto'
                              >
                                <Link className='h-4 w-4' color='#9F9FA9' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='p-1 h-auto'
                              >
                                <Pause className='h-4 w-4' color='#9F9FA9' />
                              </Button>
                            </div>
                            {/* Mobile dropdown */}
                            <div className='sm:hidden'>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='p-1 h-auto'
                                  >
                                    <MoreHorizontal className='h-4 w-4' />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align='end'
                                  className='bg-gray-800 border-[#27272A]'
                                >
                                  <DropdownMenuItem className='text-white hover:bg-gray-700 cursor-pointer'>
                                    <PenLine
                                      className='h-4 w-4 mr-2'
                                      color='#9F9FA9'
                                    />{" "}
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className='text-white hover:bg-gray-700 cursor-pointer'>
                                    <Trash2
                                      className='h-4 w-4 mr-2'
                                      color='#9F9FA9'
                                    />{" "}
                                    Delete
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className='text-white hover:bg-gray-700 cursor-pointer'>
                                    <Link
                                      className='h-4 w-4 mr-2'
                                      color='#9F9FA9'
                                    />{" "}
                                    Copy Link
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className='max-w-lg mx-auto p-2 my-6'>
                  <Image
                    src={Avalance3d}
                    objectFit='contain'
                    alt='avalance icon'
                  />

                  <div className='my-2'>
                    <h2 className='text-white text-2xl text-center font-medium'>
                      Create your first listing
                    </h2>
                    <p className='text-[#9F9FA9] text-sm text-center'>
                      and start getting contributions
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        <PaginationComponent
          currentPage={currentPage}
          onPageChange={handlePageChange}
          totalPages={listings?.metadata.last_page ?? 1} // Replace with actual total pages from API
        />
      </div>
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
      <p className='text-2xl md:text-3xl font-semibold text-[#F8FAFC]'>
        {value}
      </p>
      <p className='text-[#9F9FA9] font-light text-sm sm:text-base'>{label}</p>
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
          : "text-gray-400 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
