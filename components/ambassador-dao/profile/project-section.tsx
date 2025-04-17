import { BriefcaseBusiness, File, Search } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import DatePicker from "../DatePicker";
import { FilterDropdown } from "../dashboard/FilterDropdown";
import { jobTypes } from "../constants";
import Token from "@/public/ambassador-dao-images/token.png";
import XP from "@/public/ambassador-dao-images/sparkles.png";

import { useFetchUserProjects } from "@/services/ambassador-dao/requests/users";
import Loader from "../ui/Loader";
import { Pagination } from "../ui/Pagination";
import { useDebounce } from "../hooks/useDebounce";

export default function ProjectSection() {
  const navigationTabs = ["Bounties", "Jobs"];

  const [activeTab, setActiveTab] = useState("Bounties");
  const [activeProjectTab, setActiveProjectTab] = useState("APPLIED");
  const [date, setDate] = useState<string | null>(null);
  const [category, setCategory] = useState({
    category: jobTypes[0].id,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const jobType = activeTab === "Bounties" ? "BOUNTY" : "JOB";

  const debouncedJobSearch = useDebounce(searchQuery, 1000);
  console.log(debouncedJobSearch);

  const {
    data: userProjects,
    isLoading: isLoadingUserProjects,
    refetch,
  } = useFetchUserProjects({
    type: jobType,
    status: activeProjectTab,
    category: category.category,
    date_applied_start: date ? date : undefined,
    query: debouncedJobSearch,
    page: currentPage,
  });

  const projectTabs = [
    {
      id: "APPLIED",
      count: userProjects?.data?.stats.applied,
      bgColor: "bg-[#161617]",
    },
    {
      id: "WON",
      count: userProjects?.data?.stats.won,
      bgColor: "bg-[#27272A]",
    },
    {
      id: "CLOSED",
      count: userProjects?.data?.stats.closed,
      bgColor: "bg-[#27272A]",
    },
  ];

  useEffect(() => {
    refetch();
  }, [
    activeTab,
    activeProjectTab,
    date,
    category,
    debouncedJobSearch,
    refetch,
  ]);

  const resetFilters = () => {
    setDate(null);
    setSearchQuery("");
  };

  const handleSearchChange = (e: {
    target: { value: React.SetStateAction<string> };
  }) => {
    setSearchQuery(e.target.value);
  };

  const handleTabChange = (tab: React.SetStateAction<string>) => {
    setActiveTab(tab);
  };

  const handleProjectTabChange = (tabId: React.SetStateAction<string>) => {
    setActiveProjectTab(tabId);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="border rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-medium">My Projects</h2>
        {(date || debouncedJobSearch) && (
          <button
            onClick={resetFilters}
            className="text-xs sm:text-sm text-red-500 hover:text-red-600"
          >
            Reset Filters
          </button>
        )}
        <div className="sm:hidden flex">
          {navigationTabs.map((tab) => (
            <button
              key={tab}
              className={`px-1 py-2 border-b text-xs font-bold h-[38px] ${
                activeTab === tab
                  ? "border-[#FB2C36] text-[#FB2C36]"
                  : " border-transparent text-[var(--secondary-text-color)] bg-[#0000000D]"
              }`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between mb-8 border-b border-[var(--default-border-color)] pb-2">
        <div className="hidden sm:flex">
          {navigationTabs.map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 h-[38px] ${
                activeTab === tab
                  ? "bg-red-500 text-white"
                  : "text-[var(--secondary-text-color)] bg-[#0000000D] shadow-sm"
              } rounded-md`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <DatePicker
            value={date || undefined}
            onChange={(newDate) => setDate(newDate as unknown as null)}
          />

          <FilterDropdown
            label="Category"
            options={jobTypes}
            value={category?.category}
            onValueChange={(value) => setCategory({ category: value })}
          />

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder={`Search ${activeTab}`}
              className="text-sm lg:text-base h-11 border border-[var(--default-border-color)] rounded-md px-4 py-2 focus:outline-none w-full"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Search color="#9F9FA9" className="h-3 w-3 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="flex flex-row sm:flex-col mb-2 md:mb-0 max-w-[180px] gap-2">
          {projectTabs?.map((tab) => (
            <button
              key={tab.id}
              className={`flex justify-between items-center px-2 sm:px-4 py-3 rounded-xl ${
                tab.bgColor
              } max-w-[360px] max-h-[74px] sm:h-[74px] mb-2 ${
                activeProjectTab === tab.id ? "bg-red-500" : "bg-transparent"
              }`}
              onClick={() => handleProjectTabChange(tab.id)}
            >
              <span
                className={`capitalize text-xs sm:!text-lg ${
                  activeProjectTab === tab.id
                    ? "text-[var(--primary-text-color)]"
                    : "text-[var(--secondary-text-color)]"
                }`}
              >
                {tab?.id?.toLowerCase()}
              </span>
              {!isLoadingUserProjects && (
                <span className="ml-1 bg-white text-[#161617] text-xs px-2.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4 col-span-4">
          {isLoadingUserProjects && <Loader />}
          {!isLoadingUserProjects &&
            userProjects?.data &&
            (userProjects?.data?.opportunities?.length ||
              userProjects?.data?.submissions?.length) > 0 &&
            (
              userProjects?.data?.opportunities ||
              userProjects?.data?.submissions
            )?.map(
              (project: {
                opportunity: {
                  id: React.Key;
                  profile_image: string;
                  title: string;
                  name: any;
                  description: string;
                  total_budget: number;
                  xp_allocated: number;
                  type: string;
                  _count: any;
                  rewards: any;
                  status: string;
                  created_by: any;
                };
                status: string;
              }) => (
                <div
                  key={project?.opportunity?.id}
                  className="bg-[#161617] shadow-sm rounded-lg p-4 border border-[var(--default-border-color)]"
                >
                  <div className="grid grid-cols-1 xl:grid-cols-3 space-y-2 md:space-y-0">
                    <div className="flex items-start col-span-1">
                      <div className="w-10 h-10 bg-blue-500 rounded-full mr-3 overflow-hidden">
                        <Image
                          src={project?.opportunity?.created_by?.profile_image}
                          alt="Project"
                          className="w-full h-full object-cover"
                          width={48}
                          height={48}
                        />
                      </div>
                      <div>
                        <h3 className="text-[#FF394A] font-medium truncate max-w-[150px] w-full sm:max-w-[240px] text-sm sm:text-base">
                          {project?.opportunity?.title}
                        </h3>
                        <p className="text-[var(--secondary-text-color)] text-sm sm:text-base w-full truncate max-w-[150px] sm:max-w-[240px]">
                          {project?.opportunity?.description ||
                            "kjdhghsgkjhsdakdshjjsdkdhfsbdfjhhasdhjadjaj"}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:justify-around">
                      <div className="flex gap-1 flex-row sm:flex-col sm:items-center">
                        <BriefcaseBusiness size={14} color="#9F9FA9" />
                        <span className="text-xs text-[var(--secondary-text-color)] capitalize">
                          {project?.opportunity?.type?.toLowerCase() || jobType}
                        </span>
                      </div>

                      <div className="flex gap-1 flex-row sm:flex-col sm:items-center">
                        <File color="#9F9FA9" size={12} />
                        <p className="text-[var(--secondary-text-color)] text-xs flex w-max">
                          {(() => {
                            const appCount =
                              project?.opportunity?._count?.applications || 0;
                            const subCount =
                              project?.opportunity?._count?.submissions || 0;

                            if (appCount > 0) {
                              return `${appCount} ${
                                appCount === 1 ? "Application" : "Applications"
                              }`;
                            } else {
                              return `${subCount} ${
                                subCount === 1 ? "Proposal" : "Proposals"
                              }`;
                            }
                          })()}
                        </p>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap flex-row space-x-3">
                        {project?.opportunity?.total_budget > 0 && (
                          <div className="flex items-center text-xs">
                            <Image src={Token} alt="$" />
                            <span className="text-[var(--white-text-color)] ml-1 w-max">
                              {`${project?.opportunity?.total_budget} USDC`}
                            </span>
                          </div>
                        )}
                        {project?.opportunity?.xp_allocated > 0 && (
                          <div className="flex justify-start text-xs sm:px-2 py-3 rounded-full">
                            <Image src={XP} alt="$" />
                            <span className="text-white">
                              {project?.opportunity?.xp_allocated} XP
                            </span>
                          </div>
                        )}
                      </div>

                      <button className="bg-blue-600 text-[var(--white-text-color)] text-xs px-3 py-1 rounded-full w-max">
                        {project.status}
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          {!isLoadingUserProjects &&
            (
              userProjects?.data?.opportunities ||
              userProjects?.data?.submissions
            ).length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-[var(--secondary-text-color)]">
                <Search size={48} className="mb-2 opacity-30" />
                <p>No projects found matching your filters</p>
              </div>
            )}

          {userProjects?.metadata.last_page > 1 && (
            <Pagination
              metadata={userProjects?.metadata}
              onPageChange={handlePageChange}
              className="my-8"
            />
          )}
        </div>
      </div>
    </div>
  );
}
