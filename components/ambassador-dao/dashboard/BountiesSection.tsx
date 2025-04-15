"use client";

import { SetStateAction } from "react";
import { Search } from "lucide-react";
import EmptyState from "../ui/EmptyState";
import { budgetRange, jobTypes, statusOptions } from "../constants";
import { useFetchAllSkills } from "@/services/ambassador-dao/requests/onboard";
import { ViewAllButton } from "./ViewAllButton";
import { FilterDropdown } from "./FilterDropdown";
import { BountyCard } from "./BountyCard";
import { filter } from "@mdxeditor/editor";
import Loader from "../ui/Loader";

interface BountiesSectionProps {
  data: any[];
  isLoading: boolean;
  filters: {
    type: string;
    query: string;
    category: string;
    skill_ids: string;
    min_budget: string;
    max_budget: string;
    status: string;
  };
  searchInput: string;
  handleSearchChange: (e: {
    target: { value: SetStateAction<string> };
  }) => void;
  updateFilters: (newFilterValues: any) => void;
}

const BountiesSection = ({
  data,
  isLoading,
  filters,
  searchInput,
  handleSearchChange,
  updateFilters,
}: BountiesSectionProps) => {
  const { data: skills } = useFetchAllSkills();

  const clearAllFilters = () => {
    updateFilters({
      query: "",
      min_budget: "",
      max_budget: "",
      skill_ids: "",
      category: "",
      status: "",
    });
    if (handleSearchChange) {
      const resetEvent = {
        target: { value: "" },
      };
      handleSearchChange(resetEvent);
    }
  };


  return (
    <section className="border border-[var(--default-border-color)] rounded-md py-14 px-8">
      <h2 className="text-3xl font-bold mb-6">ALL BOUNTIES</h2>
      <div className="flex gap-4 mb-6 flex-wrap">
        <FilterDropdown
          label="Skill Set"
          options={skills}
          value={filters.skill_ids}
          onValueChange={(value) => updateFilters({ skill_ids: value })}
        />

        <FilterDropdown
          label="Bounty Type"
          options={jobTypes}
          value={filters.category}
          onValueChange={(value) => updateFilters({ category: value })}
        />

        <FilterDropdown
          label="Budget"
          options={budgetRange}
          value={
            filters?.min_budget &&
            `${filters.min_budget.toString()}-${filters?.max_budget.toString()}`
          }
          onValueChange={(value) => {
            const [minBudget, maxBudget] = value
              ?.split("-")
              .map((value) => parseInt(value, 10));
            updateFilters({ min_budget: minBudget, max_budget: maxBudget });
          }}
        />

        <FilterDropdown
          label="Status"
          options={statusOptions}
          value={filters.status}
          onValueChange={(value) => updateFilters({ status: value })}
        />

        {/* Search input */}
        <div className="relative min-w-[200px]">
          <input
            type="text"
            placeholder="Search Bounties"
            value={searchInput}
            onChange={handleSearchChange}
            className="text-xs sm:text-sm lg:text-base h-8 sm:h-11 border border-[var(--default-border-color)] rounded-md px-4 py-2 focus:outline-none w-full"
          />
          <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Search color="#9F9FA9" className="h-3 w-3 sm:w-5 sm:h-5" />
          </button>
        </div>
        {(filters.query ||
          filters.category ||
          filters.skill_ids ||
          filters.min_budget ||
          filters.max_budget ||
          filters.status) && (
          <span
            className="flex cursor-pointer rounded-lg px-4 py-2 text-red-500 items-center border border-[var(--default-border-color)] text-xs sm:text-sm lg:text-base"
            onClick={clearAllFilters}
          >
            Reset Filters
          </span>
        )}
      </div>

      <div className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center h-[400px] py-14 mb-12">
            <Loader />
          </div>
        )}

        {!isLoading &&
          data?.length > 0 &&
          data.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} />)}

        {!isLoading && data?.length === 0 && (
          <EmptyState
            title="No Bounty Matches Your Filters"
            description="Try adjusting criteria"
            className="mt-8"
          />
        )}
      </div>

      {data?.length > 0 && <ViewAllButton type="bounties" />}
    </section>
  );
};

export default BountiesSection;
