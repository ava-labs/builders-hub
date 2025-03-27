import { BriefcaseBusiness, File, Search } from 'lucide-react'
import Image from 'next/image'
import React, { useState } from 'react'
import DatePicker from '../DatePicker'
import { FilterDropdown } from '../dashboard/FilterDropdown'
import { categories } from '../constants'
import Token from "@/public/ambassador-dao-images/token.png";


export default function ProjectSection({projects, navigationTabs, projectTabs}: any) {

    const [activeTab, setActiveTab] = useState("Bounties");
    const [activeProjectTab, setActiveProjectTab] = useState("Applied");
    const [date, setDate] = useState(null);

  return (
    
    <div className="border rounded-lg p-6 mb-6">
    <h2 className="text-2xl font-bold mb-4">My Projects</h2>

    <div className="flex justify-between mb-4 border-b border-gray-800 pb-8">
      <div>
        {navigationTabs.map((tab: string) => (
          <button
            key={tab}
            className={`px-4 py-2 ${
              activeTab === tab
                ? "bg-red-500 text-white"
                : "text-gray-400"
            } rounded-md`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <DatePicker
          value={date || undefined}
          onChange={(newDate) => setDate(newDate as any)}
        />

        <FilterDropdown label="Category" options={categories} />

        <div className="relative min-w-[200px]">
          <input
            type="text"
            placeholder="Search Bounties"
            className="text-xs sm:text-sm lg:text-base h-8 sm:h-11 border border-[#27272A] rounded-md px-4 py-2 focus:outline-none w-full"
          />
          <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Search color="#9F9FA9" className="h-3 w-3 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="flex flex-col mb-2 md:mb-0">
        {projectTabs?.map((tab: any) => (
          <button
            key={tab.id}
            className={`flex justify-between items-center px-4 py-2 rounded-xl ${
              tab.bgColor
            } max-w-[360px] h-[74px] mb-2 ${
              activeProjectTab === tab.id
                ? "bg-red-500"
                : "bg-transparent"
            }`}
            onClick={() => setActiveProjectTab(tab.id)}
          >
            <span
              className={`${
                activeProjectTab === tab.id
                  ? "text-[#FAFAFA]"
                  : "text-[#9F9FA9]"
              }`}
            >
              {tab.id}
            </span>
            <span className="ml-1 bg-white text-[#161617] text-xs px-2 py-1 rounded-full">
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div className="space-y-4 col-span-2">
        {projects.map((project: any) => (
          <div
            key={project.id}
            className="bg-[#161617] shadow-sm rounded-lg p-4"
          >
            <div className="flex flex-col md:flex-row justify-between">
              <div className="flex">
                <div className="w-10 h-10 bg-blue-500 rounded-full mr-3 overflow-hidden">
                  <img
                    src="/api/placeholder/40/40"
                    alt="Project"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-red-500 font-bold">
                    {project.name}
                  </h3>
                  <p className="text-gray-400 text-xs">
                    {project.description}
                  </p>
                </div>
              </div>
              <div className="flex mt-4 md:mt-0 items-center space-x-6">
                <div className="flex flex-col justify-center gap-1">
                  <BriefcaseBusiness color="#9F9FA9" size={12} />
                  <p className="text-gray-400 text-xs">{project.type}</p>
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <File color="#9F9FA9" size={12} />
                  <p className="text-gray-400 text-xs">
                    {project.proposals} Proposals
                  </p>
                </div>
                <div className="text-center flex items-center text-xs gap-1">
                  <Image src={Token} alt="$" />
                  <span className="text-white">
                    {project.reward} USDC
                  </span>
                </div>
                <div>
                  <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                    {project.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>

  )
}
