"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Tone from "@/public/ambassador-dao-images/Frame.png";
import Halftone from "@/public/ambassador-dao-images/Halftone.png";
import { useFetchUserStatsDataQuery } from "@/services/ambassador-dao/requests/auth";
import { useFetchPastOpportunities, useFetchPublicUserDetails } from "@/services/ambassador-dao/requests/users";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";

function ProfileContent() {
  const searchParams = useSearchParams();
  const usernameFromUrl = searchParams.get("username");
  const [copySuccess, setCopySuccess] = useState(false);

  const { data: userDetails, isLoading: isLoadingDetails } =
    useFetchPublicUserDetails(usernameFromUrl);


    const { data: userPastJobOpportunities, isLoading: isLoadingPastJobOpportunities } =
    useFetchPastOpportunities(usernameFromUrl, "JOB");

    const { data: userPastBountyOpportunities, isLoading: isLoadingPastBountyOpportunities } =
    useFetchPastOpportunities(usernameFromUrl, "BOUNTY");

  const { data: userStats, isLoading: isLoadingStats } =
    useFetchUserStatsDataQuery(usernameFromUrl);

  const handleShareClick = () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/ambassador-dao/public-profile?username=${usernameFromUrl}`;

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

  const profile = {
    name: userDetails
      ? `${userDetails.first_name || ""} ${userDetails.last_name || ""}`
      : "-",
    username: userDetails
      ? `@${userDetails.username || usernameFromUrl}`
      : `@${usernameFromUrl}`,
    location: userDetails?.location || "Not specified",
    skills: userDetails?.skills || [],
    socials: userDetails?.social_links || [],
    stats: {
      earned: userStats?.total_earnings || 0,
      submissions: userStats?.total_submissions || 0,
      bounty: userStats?.total_bounties_won || 0,
    },
  };

  if (isLoadingDetails || isLoadingStats) {
    return (
      <div className="bg-black text-white min-h-screen flex justify-center items-center">
        <FullScreenLoader /> 
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <div className="border rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b-2 pb-8">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-16 h-16 bg-blue-500 rounded-full mr-4 overflow-hidden">
                <img
                  src={userDetails?.avatar || "/api/placeholder/50/50"}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-base font-bold">{profile.name}</h2>
                <p className="text-[#9F9FA9] text-sm">{profile.username}</p>
              </div>
            </div>
            <div className="flex space-x-3 relative">
              <button
                onClick={handleShareClick}
                className="border border-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md"
              >
                {copySuccess ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h3 className="text-3xl font-medium mb-2">Details</h3>
              <p className="text-[#F5F5F9]">Base in: {profile.location}</p>
            </div>
            <div>
              <h3 className="text-3xl font-medium mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.skills?.length > 0 ? (
                  profile?.skills?.map(
                    (skill: { name: string, id: number }, index: number) => (
                      <span
                        key={index}
                        className="bg-[#F5F5F9] text-[#161617] px-3 py-1 rounded-full text-sm"
                      >
                        {skill.name}
                      </span>
                    )
                  )
                ) : (
                  <span className="text-[#9F9FA9]">No skills listed</span>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-medium mb-2">Socials</h3>
              <div className="flex flex-wrap gap-2">
                {profile.socials.length > 0 ? (
                  profile.socials.map(
                    (social: string, index: number) => (
                      <span
                        key={index}
                        className="bg-[#F5F5F9] text-[#161617] px-3 py-1 rounded-full text-sm"
                      >
                        {social}
                      </span>
                    )
                  )
                ) : (
                  <span className="text-[#9F9FA9]">No socials listed</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center mt-1">
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
                  {profile.stats.bounty}
                </h2>
                <p className="text-[#F5F5F9] text-xs">Bounty</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border w-full rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Portfolio</h2>

          <div className="mb-6">
            <Image src={Halftone} alt="Portfolio item" />
            <div className="flex justify-between mt-2">
              <div>
                <h3 className="font-medium">MISSION NAME</h3>
              </div>
              <div>
                <button className="text-blue-400 hover:underline">
                  View all
                </button>
              </div>
            </div>
          </div>

          <div>
            <Image src={Tone} alt="Portfolio item" />
            <div className="flex justify-between mt-2">
              <div>
                <h3 className="font-medium">MISSION NAME</h3>
              </div>
              <div>
                <button className="text-blue-400 hover:underline">
                  View all
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AmbasssadorDaoPublicProfilePage = () => {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <ProfileContent />
    </Suspense>
  );
};

export default AmbasssadorDaoPublicProfilePage;