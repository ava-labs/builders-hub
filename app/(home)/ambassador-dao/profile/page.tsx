"use client";

import { File } from "lucide-react";
import React, { useState } from "react";
import Token from "@/public/ambassador-dao-images/token.png";

import Image from "next/image";
import {
  useFetchUserDataQuery,
  useFetchUserStatsDataQuery,
} from "@/services/ambassador-dao/requests/auth";
import ClaimXPModal from "@/components/ambassador-dao/profile/xp-modal";
import XpSection from "@/components/ambassador-dao/profile/xp-section";
import ProjectSection from "@/components/ambassador-dao/profile/project-section";
import { useFetchUserPendingRewards, useFetchUserProjects } from "@/services/ambassador-dao/requests/users";

const AmbasssadorDaoProfilePage = () => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const { data, isLoading } = useFetchUserDataQuery();

  const { data: userStats, isLoading: isLoadingStats } =
    useFetchUserStatsDataQuery(data?.username);

    const { data: userPendingRewards, isLoading: isLoadingRewards } =
    useFetchUserPendingRewards();

    console.log(userPendingRewards, "projects", isLoadingRewards)


  const userRole = data?.role;

  const navigationTabs = ["Bounties", "Jobs"];
  const projectTabs = [
    { id: "Applied", count: 4, bgColor: "bg-[#161617]" },
    { id: "Won", count: 4, bgColor: "bg-[#27272A]" },
    { id: "Closed", count: 4, bgColor: "bg-[#27272A]" },
  ];

  const profile = {
    name: data ? `${data.first_name || ""} ${data.last_name || ""}` : "-",
    username: data ? `${data.username || ""}` : "-",
    location: "United States",
    skills: data?.skills || "-",
    socials: data?.social_links || null,
    stats: {
      earned: userStats?.total_earnings || 0,
      submissions: userStats?.total_submissions || 0,
      bounty: userStats?.total_bounties_won || 0,
      job: userStats?.total_applications || 0,
    },
  };

  const projects = [
    {
      id: 1,
      name: "Project Name",
      description: "Lorem ipsum Dolor Sit Amet, Consetetur S...",
      type: "Job",
      proposals: 60,
      reward: 1000,
      status: "Reward Pending",
    },
    {
      id: 2,
      name: "Project Name",
      description: "Lorem ipsum Dolor Sit Amet, Consetetur S...",
      type: "Job",
      proposals: 60,
      reward: 1000,
      status: "Reward Pending",
    },
    {
      id: 3,
      name: "Project Name",
      description: "Lorem ipsum Dolor Sit Amet, Consetetur S...",
      type: "Job",
      proposals: 60,
      reward: 1000,
      status: "Reward Pending",
    },
    {
      id: 4,
      name: "Project Name",
      description: "Lorem ipsum Dolor Sit Amet, Consetetur S...",
      type: "Job",
      proposals: 60,
      reward: 1000,
      status: "Reward Pending",
    },
    {
      id: 5,
      name: "Project Name",
      description: "Lorem ipsum Dolor Sit Amet, Consetetur S...",
      type: "Job",
      proposals: 60,
      reward: 1000,
      status: "Reward Pending",
    },
  ];

  const xpProgressionData = {
    currentXP: data?.points?.balance,
    monthlyGrowth: 850,
    availableOpportunities: [
      {
        id: 1,
        title: "Write a Twitter thread on Musk X project & SM-90T token",
        company: "Company Name",
        bounty: true,
        due: "2d",
        proposals: 60,
        reward: 1000,
        xp: 200,
      },
      {
        id: 2,
        title: "Write a Twitter thread on Musk X project & SM-90T token",
        company: "Company Name",
        bounty: true,
        due: "2d",
        proposals: 60,
        reward: 1000,
        xp: 200,
      },
    ],
  };

  const rewardsPendingData = {
    projects: [
      {
        id: 1,
        name: "Project Name",
        description: "Lorem ipsum Dolor Sit Amet, Consectetur S...",
        proposals: 60,
        reward: 1000,
        xp: 200,
      },
      {
        id: 2,
        name: "Project Name",
        description: "Lorem ipsum Dolor Sit Amet, Consectetur S...",
        proposals: 60,
        reward: 1000,
        xp: 200,
      },
      {
        id: 3,
        name: "Project Name",
        description: "Lorem ipsum Dolor Sit Amet, Consectetur S...",
        proposals: 60,
        reward: 1000,
        xp: 200,
      },
    ],
  };

  const handleShareClick = () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/ambassador-dao/public-profile?username=${data?.username}`;

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy URL: ", err);
      });
  };

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <div className="border rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b-2 pb-8">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-16 h-16 bg-blue-500 rounded-full mr-4 overflow-hidden">
                <img
                  src="/api/placeholder/50/50"
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-base font-bold">{profile.name}</h2>
                <p className="text-[#9F9FA9] text-sm">{profile.username}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md">
                Edit Profile
              </button>
              <button
                onClick={handleShareClick}
                className="border border-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md"
              >
                {copySuccess ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="text-3xl font-medium mb-2">Details</h3>
              <p className="text-[#F5F5F9]">Base in: {profile.location}</p>
            </div>
            <div>
              <h3 className="text-3xl font-medium mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.skills?.map((skill: { name: string; id: string }) => (
                  <span
                    key={skill.id}
                    className="bg-[#F5F5F9] text-[#161617] px-3 py-1 rounded-full text-sm"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-medium mb-2">Socials</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.socials?.map((social: string, index: number) => (
                  <span
                    key={index}
                    className="bg-[#F5F5F9] text-[#161617] px-3 py-1 rounded-full text-sm"
                  >
                    {social}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6 text-center mt-1">
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.earned}
                </h2>
                <p className="text-[#F5F5F9] text-xs">Earned</p>
              </div>
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.submissions}
                </h2>
                <p className="text-[#F5F5F9] text-xs">Submissions</p>
              </div>
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.job}
                </h2>
                <p className="text-[#F5F5F9] text-xs">Job</p>
              </div>
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.bounty}
                </h2>
                <p className="text-[#F5F5F9] text-xs">Bounty</p>
              </div>
            </div>
          </div>
        </div>

        {userRole === "AMBASSADOR" && <XpSection data={xpProgressionData} />}

        <div className="border rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Reward Pending</h2>
            {userRole === "AMBASSADOR" && (
              <button
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm"
                onClick={() => setIsModalOpen(true)}
              >
                Claim XP
              </button>
            )}
          </div>

          <div className="space-y-4">
            {userPendingRewards?.map((project:any, index:number) => (
              <div key={index} className="bg-[#161617] rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-blue-500 rounded-full mr-3 overflow-hidden">
                      <img
                        src="/api/placeholder/40/40"
                        alt="Project"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-red-500 font-bold">{project?.name || "Project name"}</h3>
                      <p className="text-gray-400 text-xs">
                        {project?.description || "Lorem ipsum jagshgh jhgashgasj"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-center">
                      <File size={14} color="#9F9FA9" />
                      <span className="text-xs text-gray-400">
                        {project?.proposals || 10}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center text-xs">
                        <Image src={Token} alt="$" />
                        <span className="text-white ml-1">
                          {project.amount} USDC
                        </span>
                      </div>
                      <div className="flex items-center text-xs bg-gray-800 px-2 py-1 rounded-full">
                        <span className="text-white">{project?.xp || 200} XP</span>
                      </div>
                    </div>

                    <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                      Reward Pending
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ProjectSection />
      </div>

      {isModalOpen && (
        <ClaimXPModal
          id={"1"}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default AmbasssadorDaoProfilePage;
