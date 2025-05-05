"use client";

import { useState, useEffect, SetStateAction } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFetchOpportunity } from "@/services/ambassador-dao/requests/opportunity";
import { useDebounce } from "@/components/ambassador-dao/hooks/useDebounce";
import { AuthModal } from "../sections/auth-modal";
import JobsSection from "./JobSection";
import BountiesSection from "./BountiesSection";
import { GoBackButton } from "./BackButton";
import SideContent from "./SideContent";
import { Pagination } from "../ui/Pagination";
import CategoryTabs from "../ui/CategoryTabs";

const CATEGORY_SKILL_MAPPING: Record<string, string> = {
  code: "cm9r1jr940006a4d3udlj6zyl",
  design: "cm9r1k7p10007a4d3vff8c9gr",
  technology: "cm9r1jn540005a4d30rj0likh",
  content: "cm9r1kcbb0008a4d3mw99d9bb",
};

const SKILL_TO_CATEGORY_MAPPING: Record<string, string> = Object.entries(
  CATEGORY_SKILL_MAPPING
).reduce((acc, [category, skillId]) => {
  acc[skillId] = category;
  return acc;
}, {} as Record<string, string>);

const MainContent = ({ user }: { user: any }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const [openAuthModal, setOpenAuthModal] = useState(false);
  const [currentJobPage, setCurrentJobPage] = useState(1);
  const [currentBountyPage, setCurrentBountyPage] = useState(1);

  const jobSkillIds = searchParams.get("job_skill_ids") || "";
  const bountySkillIds = searchParams.get("bounty_skill_ids") || "";

  const getSelectedCategoryFromSkillIds = (): string => {
    if (jobSkillIds && SKILL_TO_CATEGORY_MAPPING[jobSkillIds]) {
      return SKILL_TO_CATEGORY_MAPPING[jobSkillIds];
    } else if (bountySkillIds && SKILL_TO_CATEGORY_MAPPING[bountySkillIds]) {
      return SKILL_TO_CATEGORY_MAPPING[bountySkillIds];
    }
    return "";
  };

  const [selectedCategory, setSelectedCategory] = useState<string>(
    getSelectedCategoryFromSkillIds()
  );

  const [isFiltering, setIsFiltering] = useState(false);

  const [jobFilters, setJobFilters] = useState({
    type: "JOB",
    query: searchParams.get("job_query") || "",
    skill_ids: jobSkillIds,
    min_budget: searchParams.get("job_min_budget") || "",
    max_budget: searchParams.get("job_max_budget") || "",
    category: searchParams.get("job_category") || "",
    status: searchParams.get("job_status") || "",
    page: currentJobPage,
  });

  const [bountyFilters, setBountyFilters] = useState({
    type: "BOUNTY",
    query: searchParams.get("bounty_query") || "",
    skill_ids: bountySkillIds,
    min_budget: searchParams.get("bounty_min_budget") || "",
    max_budget: searchParams.get("bounty_max_budget") || "",
    category: searchParams.get("bounty_category") || "",
    status: searchParams.get("bounty_status") || "",
    page: currentBountyPage,
  });

  useEffect(() => {
    const category = getSelectedCategoryFromSkillIds();
    setSelectedCategory(category);
  }, [jobSkillIds, bountySkillIds]);

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
        skill_ids: searchParams.get("job_skill_ids") || "",
        min_budget: searchParams.get("job_min_budget") || "",
        max_budget: searchParams.get("job_max_budget") || "",
        category: searchParams.get("job_category") || "",
        status: searchParams.get("job_status") || "",
        page: currentJobPage,
      };

      setJobFilters(newJobFilters);

      const newBountyFilters = {
        type: "BOUNTY",
        query: searchParams.get("bounty_query") || "",
        skill_ids: searchParams.get("bounty_skill_ids") || "",
        min_budget: searchParams.get("bounty_min_budget") || "",
        max_budget: searchParams.get("bounty_max_budget") || "",
        category: searchParams.get("bounty_category") || "",
        status: searchParams.get("bounty_status") || "",
        page: currentBountyPage,
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

    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilterValues as object).forEach(([key, value]) => {
      if (value) {
        params.set(`job_${key}`, String(value));
      } else {
        params.delete(`job_${key}`);
      }
    });

    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);

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

    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newFilterValues as object).forEach(([key, value]) => {
      if (value) {
        params.set(`bounty_${key}`, String(value));
      } else {
        params.delete(`bounty_${key}`);
      }
    });

    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);

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

  const handleJobPageChange = (page: number) => {
    setCurrentJobPage(page);

    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  };

  const handleBountyPageChange = (page: number) => {
    setCurrentBountyPage(page);

    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  };

  const handleCategoryChange = (category: string) => {
    // If empty category selected (or same category clicked again), clear filters
    // if (!category || category === selectedCategory) {
    //   setSelectedCategory("");

    //   // Create new URLSearchParams object
    //   const params = new URLSearchParams(searchParams.toString());

    //   // Clear skill IDs from URL
    //   params.delete("job_skill_ids");
    //   params.delete("bounty_skill_ids");

    //   // Update URL
    //   router.push(`${pathname}?${params.toString()}`);

    //   // Update local filter states
    //   setJobFilters({
    //     ...jobFilters,
    //     skill_ids: ""
    //   });

    //   setBountyFilters({
    //     ...bountyFilters,
    //     skill_ids: ""
    //   });

    //   return;
    // }

    setSelectedCategory(category);

    const skillId = CATEGORY_SKILL_MAPPING[category] || "";

    const params = new URLSearchParams(searchParams.toString());

    params.set("job_skill_ids", skillId);
    params.set("bounty_skill_ids", skillId);

    router.push(`${pathname}?${params.toString()}`);

    setJobFilters({
      ...jobFilters,
      skill_ids: skillId,
    });

    setBountyFilters({
      ...bountyFilters,
      skill_ids: skillId,
    });
  };

  const resetAllFilters = () => {
    setSelectedCategory("");

    const params = new URLSearchParams();

    if (type) {
      params.set("type", type);
    }

    router.push(`${pathname}?${params.toString()}`);

    setJobFilters({
      type: "JOB",
      query: "",
      skill_ids: "",
      min_budget: "",
      max_budget: "",
      category: "",
      status: "",
      page: 1,
    });

    setBountyFilters({
      type: "BOUNTY",
      query: "",
      skill_ids: "",
      min_budget: "",
      max_budget: "",
      category: "",
      status: "",
      page: 1,
    });

    setSearchJobInput("");
    setSearchBountyInput("");
    setCurrentJobPage(1);
    setCurrentBountyPage(1);
  };

  const jobs = jobsData?.data || [];
  const bounties = bountiesData?.data || [];

  const renderContent = () => {
    if (type === "bounties") {
      return (
        <>
          <BountiesSection
            isLoading={isBountiesLoading}
            data={bounties}
            filters={bountyFilters}
            searchInput={searchBountyInput}
            handleSearchChange={handleBountySearchChange}
            updateFilters={updateBountyFilters}
            onResetFilters={resetAllFilters}
          />

          {bountiesData?.metadata?.last_page > 1 && (
            <Pagination
              metadata={bountiesData.metadata}
              onPageChange={handleBountyPageChange}
            />
          )}
        </>
      );
    }

    if (type === "jobs") {
      return (
        <>
          <JobsSection
            isLoading={isJobsLoading}
            data={jobs}
            filters={jobFilters}
            searchInput={searchJobInput}
            handleSearchChange={handleJobSearchChange}
            updateFilters={updateJobFilters}
            onResetFilters={resetAllFilters}
          />

          {jobsData?.metadata?.last_page > 1 && (
            <Pagination
              metadata={jobsData.metadata}
              onPageChange={handleJobPageChange}
            />
          )}
        </>
      );
    }

    return (
      <>
        <div className={isBountiesLoading ? "min-h-32" : ""}>
          <BountiesSection
            isLoading={isBountiesLoading}
            data={bounties?.slice(0, 4)}
            filters={bountyFilters}
            searchInput={searchBountyInput}
            handleSearchChange={handleBountySearchChange}
            updateFilters={updateBountyFilters}
            onResetFilters={resetAllFilters}
          />
        </div>

        <div className={isJobsLoading ? "min-h-32" : ""}>
          <JobsSection
            isLoading={isJobsLoading}
            data={jobs?.slice(0, 4)}
            filters={jobFilters}
            searchInput={searchJobInput}
            handleSearchChange={handleJobSearchChange}
            updateFilters={updateJobFilters}
            onResetFilters={resetAllFilters}
          />
        </div>
      </>
    );
  };

  return (
    <>
      <GoBackButton />
      <div>
        <CategoryTabs
          onCategoryChange={handleCategoryChange}
          initialCategory={selectedCategory}
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-9 xl:gap-x-8 gap-y-8">
        <div className="lg:col-span-6 order-1 xl:order-1">
          {renderContent()}
        </div>
        <div className="order-2 xl:order-2 col-span-3">
          <SideContent user={user} />
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
