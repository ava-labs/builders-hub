"use client";

import { useState, useEffect, SetStateAction } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFetchOpportunity } from "@/services/ambassador-dao/requests/opportunity";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { useDebounce } from "@/components/ambassador-dao/hooks/useDebounce";
import { AuthModal } from "../sections/auth-modal";
import JobsSection from "./JobSection";
import BountiesSection from "./BountiesSection";
import { GoBackButton } from "./BackButton";
import SideContent from "./SideContent";
import { Pagination } from "../ui/Pagination";

const MainContent = ({ user }: { user: any }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const [openAuthModal, setOpenAuthModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltering, setIsFiltering] = useState(false);

  const [jobFilters, setJobFilters] = useState({
    type: "JOB",
    query: searchParams.get("job_query") || "",
    skillSet: searchParams.get("job_skillSet") || "",
    min_budget: searchParams.get("job_min_budget") || "",
    category: searchParams.get("job_category") || "",
    status: searchParams.get("job_status") || "",
  });

  const [bountyFilters, setBountyFilters] = useState({
    type: "BOUNTY",
    query: searchParams.get("bounty_query") || "",
    skillSet: searchParams.get("bounty_skillSet") || "",
    min_budget: searchParams.get("bounty_min_budget") || "",
    category: searchParams.get("bounty_category") || "",
    status: searchParams.get("bounty_status") || "",
  });

  const [searchJobInput, setSearchJobInput] = useState(
    searchParams.get("job_query") || ""
  );
  const debouncedJobSearch = useDebounce(searchJobInput, 1000);

  const [searchBountyInput, setSearchBountyInput] = useState(
    searchParams.get("bounty_query") || ""
  );
  const debouncedBountySearch = useDebounce(searchBountyInput, 1000);

  useEffect(() => {
    if (debouncedJobSearch !== jobFilters.query) {
      updateJobFilters({ query: debouncedJobSearch });
    }
  }, [debouncedJobSearch]);

  useEffect(() => {
    if (debouncedBountySearch !== bountyFilters.query) {
      updateBountyFilters({ query: debouncedBountySearch });
    }
  }, [debouncedBountySearch]);

  useEffect(() => {
    if (!isFiltering) {
      const newJobFilters = {
        type: "JOB",
        query: searchParams.get("job_query") || "",
        skillSet: searchParams.get("job_skillSet") || "",
        min_budget: searchParams.get("job_min_budget") || "",
        category: searchParams.get("job_category") || "",
        status: searchParams.get("job_status") || "",
      };

      setJobFilters(newJobFilters);

      const newBountyFilters = {
        type: "BOUNTY",
        query: searchParams.get("bounty_query") || "",
        skillSet: searchParams.get("bounty_skillSet") || "",
        min_budget: searchParams.get("bounty_min_budget") || "",
        category: searchParams.get("bounty_category") || "",
        status: searchParams.get("bounty_status") || "",
      };

      setBountyFilters(newBountyFilters);
    }
  }, [searchParams, isFiltering]);

  const apiJobFilters = Object.fromEntries(
    Object.entries(jobFilters).filter(([_, value]) => value)
  );

  const apiBountyFilters = Object.fromEntries(
    Object.entries(bountyFilters).filter(([_, value]) => value)
  );

  const { data: jobsData, isLoading: isJobsLoading } = useFetchOpportunity({
    ...apiJobFilters,
    entity: "jobs",
  });

  const { data: bountiesData, isLoading: isBountiesLoading } =
    useFetchOpportunity({
      ...apiBountyFilters,
      entity: "bounties",
    });

  const updateJobFilters = (
    newFilterValues: { [s: string]: unknown } | ArrayLike<unknown>
  ) => {
    setIsFiltering(true);
    
    const updatedJobFilters = {
      ...jobFilters,
      ...Object.fromEntries(
        Object.entries(newFilterValues as object).map(([key, value]) => [
          key,
          value,
        ])
      ),
    };
    setJobFilters(updatedJobFilters);

    // Use replaceState to update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilterValues as object).forEach(([key, value]) => {
      if (value) {
        params.set(`job_${key}`, String(value));
      } else {
        params.delete(`job_${key}`);
      }
    });

    // Use history.replaceState to update URL without navigation
    window.history.replaceState(
      null, 
      '', 
      `${pathname}?${params.toString()}`
    );
    
    setIsFiltering(false);
  };

  const updateBountyFilters = (
    newFilterValues: { [s: string]: unknown } | ArrayLike<unknown>
  ) => {
    setIsFiltering(true);
    
    const updatedBountyFilters = {
      ...bountyFilters,
      ...Object.fromEntries(
        Object.entries(newFilterValues as object).map(([key, value]) => [
          key,
          value,
        ])
      ),
    };
    setBountyFilters(updatedBountyFilters);

    // Use replaceState to update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilterValues as object).forEach(([key, value]) => {
      if (value) {
        params.set(`bounty_${key}`, String(value));
      } else {
        params.delete(`bounty_${key}`);
      }
    });

    // Use history.replaceState to update URL without navigation
    window.history.replaceState(
      null, 
      '', 
      `${pathname}?${params.toString()}`
    );
    
    setIsFiltering(false);
  };

  const handleJobSearchChange = (e: {
    target: { value: SetStateAction<string> };
  }) => {
    setSearchJobInput(e.target.value);
  };

  const handleBountySearchChange = (e: {
    target: { value: SetStateAction<string> };
  }) => {
    setSearchBountyInput(e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    
    // Update URL with page parameter but don't navigate
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  };

  const jobs = jobsData?.data || [];
  const bounties = bountiesData?.data || [];

  const renderContent = () => {
    if (type === "jobs") {
      return (
        <>
          {isJobsLoading ? (
            <div className="min-h-64 flex items-center justify-center">
              <Loader />
            </div>
          ) : (
            <JobsSection
              data={jobs}
              filters={jobFilters}
              searchInput={searchJobInput}
              handleSearchChange={handleJobSearchChange}
              updateFilters={updateJobFilters}
            />
          )}

          {jobsData?.metadata?.last_page > 1 && (
            <Pagination 
              metadata={jobsData.metadata}
              onPageChange={handlePageChange}
            />
          )}
        </>
      );
    }

    if (type === "bounties") {
      return (
        <>
          {isBountiesLoading ? (
            <div className="min-h-64 flex items-center justify-center">
              <Loader />
            </div>
          ) : (
            <BountiesSection
              data={bounties}
              filters={bountyFilters}
              searchInput={searchBountyInput}
              handleSearchChange={handleBountySearchChange}
              updateFilters={updateBountyFilters}
            />
          )}
          
          {bountiesData?.metadata?.last_page > 1 && (
            <Pagination 
              metadata={bountiesData.metadata}
              onPageChange={handlePageChange}
            />
          )}
        </>
      );
    }

    return (
      <>
        <div className={isJobsLoading ? "min-h-32" : ""}>
          {isJobsLoading ? (
            <div className="flex items-center justify-center h-[400px] py-14 mb-12">
              <Loader />
            </div>
          ) : (
            <JobsSection
              data={jobs?.slice(0, 4)}
              filters={jobFilters}
              searchInput={searchJobInput}
              handleSearchChange={handleJobSearchChange}
              updateFilters={updateJobFilters}
            />
          )}
        </div>

        <div className={isBountiesLoading ? "min-h-32" : ""}>
          {isBountiesLoading ? (
            <div className="flex items-center justify-center h-[400px] py-14 mb-12">
              <Loader />
            </div>
          ) : (
            <BountiesSection
              data={bounties?.slice(0, 4)}
              filters={bountyFilters}
              searchInput={searchBountyInput}
              handleSearchChange={handleBountySearchChange}
              updateFilters={updateBountyFilters}
            />
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <GoBackButton />
      <div className="grid grid-cols-1 xl:grid-cols-9 xl:gap-x-8 gap-y-8">
        <div className="lg:col-span-6 order-2 xl:order-1">
          {renderContent()}
        </div>
        <div className="order-1 xl:order-2 col-span-3">
          <SideContent user={user} setOpenAuthModal={setOpenAuthModal} />
        </div>
      </div>
      <AuthModal
        isOpen={openAuthModal}
        onClose={() => setOpenAuthModal(false)}
        stopRedirection={true}
      />
    </>
  );
};

export default MainContent;