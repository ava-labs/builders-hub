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

const MainContent = ({user}: {user: any}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const [openAuthModal, setOpenAuthModal] = useState(false);

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
  }, [searchParams]);

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

    const params = new URLSearchParams(searchParams);

    Object.entries(newFilterValues as object).forEach(([key, value]) => {
      if (value) {
        params.set(`job_${key}`, String(value));
      } else {
        params.delete(`job_${key}`);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const updateBountyFilters = (
    newFilterValues: { [s: string]: unknown } | ArrayLike<unknown>
  ) => {
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

    const params = new URLSearchParams(searchParams);

    Object.entries(newFilterValues as object).forEach(([key, value]) => {
      if (value) {
        params.set(`bounty_${key}`, String(value));
      } else {
        params.delete(`bounty_${key}`);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
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

  const jobs = jobsData || [];
  const bounties = bountiesData || [];

  const renderContent = () => {
    if (type === "jobs") {
      return isJobsLoading ? (
        <Loader />
      ) : (
        <JobsSection
          data={jobs}
          filters={jobFilters}
          searchInput={searchJobInput}
          handleSearchChange={handleJobSearchChange}
          updateFilters={updateJobFilters}
        />
      );
    }

    if (type === "bounties") {
      return isBountiesLoading ? (
        <Loader />
      ) : (
        <BountiesSection
          data={bounties}
          filters={bountyFilters}
          searchInput={searchBountyInput}
          handleSearchChange={handleBountySearchChange}
          updateFilters={updateBountyFilters}
        />
      );
    }

    return (
      <>
        {isJobsLoading || isBountiesLoading ? <Loader /> : null}

        {!isJobsLoading || !isBountiesLoading ? (
          <JobsSection
            data={jobs}
            filters={jobFilters}
            searchInput={searchJobInput}
            handleSearchChange={handleJobSearchChange}
            updateFilters={updateJobFilters}
          />
        ) : null}

        {!isJobsLoading || !isBountiesLoading ? (
          <BountiesSection
            data={bounties}
            filters={bountyFilters}
            searchInput={searchBountyInput}
            handleSearchChange={handleBountySearchChange}
            updateFilters={updateBountyFilters}
          />
        ) : null}
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
      />
    </>
  );
};

export default MainContent;
