"use client";

import { SetStateAction } from "react";
import { BriefcaseBusiness, Search } from "lucide-react";
import EmptyState from "../ui/EmptyState";
import { sortOrderTypes } from "../constants";
import { useFetchAllSkills } from "@/services/ambassador-dao/requests/onboard";
import { ViewAllButton } from "./ViewAllButton";
import { FilterDropdown } from "./FilterDropdown";
import { JobCard } from "./JobCard";
import Loader from "../ui/Loader";

interface JobsSectionProps {
  data: any[];
  isLoading: boolean;
  filters: {
    type: string;
    query: string;
    sort_direction: string;
    skill_ids: string;
  };
  searchInput: string;
  handleSearchChange: (e: {
    target: { value: SetStateAction<string> };
  }) => void;
  updateFilters: (newFilterValues: any) => void;
  onResetFilters: () => void;
}

const JobsSection = ({
  data,
  isLoading,
  filters,
  searchInput,
  handleSearchChange,
  updateFilters,
  onResetFilters,
}: JobsSectionProps) => {
  const { data: skills } = useFetchAllSkills();

  const clearAllFilters = () => {
    updateFilters({
      query: "",
      skill_ids: "",
      sort_direction: "desc",
    });
    if (handleSearchChange) {
      const resetEvent = {
        target: { value: "" },
      };
      handleSearchChange(resetEvent);
    }
    onResetFilters;
  };

  return (
    <section className="mb-12 border border-[var(--default-border-color)] rounded-md py-10 px-3">
      <div className="flex justify-between">
        <h2 className="text-3xl font-medium mb-6 flex items-center gap-2">
          <BriefcaseBusiness size={36} color="var(--white-text-color)" /> Jobs
        </h2>
        {data?.length > 0 && <ViewAllButton type="jobs" />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 w-full">
        <FilterDropdown
          label={filters.sort_direction}
          options={sortOrderTypes}
          value={filters.sort_direction}
          onValueChange={(value) => updateFilters({ sort_direction: value })}
        />

        <FilterDropdown
          label="Skill Set"
          options={skills}
          value={filters.skill_ids}
          onValueChange={(value) => updateFilters({ skill_ids: value })}
        />
        <span
          className="flex cursor-pointer rounded-lg px-4 py-2 text-[var(--default-text-color)] items-center border dark:border-[var(--default-text-color)] text-sm"
          onClick={clearAllFilters}
        >
          Reset Filters
        </span>

        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            value={searchInput || ""}
            onChange={handleSearchChange}
            className="text-sm h-10 border border-[var(--default-border-color)] rounded-md px-4 py-2 focus:outline-none w-full"
          />
          <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Search color="#9F9FA9" className="h-3 w-3 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading && (
          <div className="min-h-64 flex items-center justify-center">
            <Loader />
          </div>
        )}

        {!isLoading &&
          data?.length > 0 &&
          data.map((job) => <JobCard key={job.id} job={job} />)}

        {!isLoading && data?.length === 0 && (
          <EmptyState
            title="No Job Matches Your Filters"
            description="Try adjusting criteria"
            className="mt-8"
          />
        )}
      </div>
    </section>
  );
};

export default JobsSection;
