"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Tone from "@/public/ambassador-dao-images/Frame.png";
import Avatar from "@/public/ambassador-dao-images/Avatar.svg";
import Halftone from "@/public/ambassador-dao-images/Halftone.png";
import { useFetchUserStatsDataQuery } from "@/services/ambassador-dao/requests/auth";
import {
  useFetchPastOpportunities,
  useFetchPublicUserDetails,
} from "@/services/ambassador-dao/requests/users";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { ArrowRight } from "lucide-react";
import { Pagination } from "@/components/ambassador-dao/ui/Pagination";
import Loader from "@/components/ambassador-dao/ui/Loader";
import EmptyState from "@/components/ambassador-dao/ui/EmptyState";
import { truncateAddress } from "@/utils/truncateAddress";

function ProfileContent() {
  const pathname = usePathname();
  const [username, setUsername] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [metadata, setMetadata] = useState({
    total: 0,
    last_page: 1,
    current_page: 1,
    per_page: 3,
    prev_page: null,
    next_page: null,
  });

  const { data: userDetails, isLoading: isLoadingDetails } =
    useFetchPublicUserDetails(username);

  const { data: userPastActivity, isLoading: isLoadingPastActivities } =
    useFetchPastOpportunities(username, {
      page: currentPage,
      per_page: 3,
    });

  useEffect(() => {
    if (pathname) {
      const usernameMatch = pathname.match(/username=([^&/]+)/);
      if (usernameMatch && usernameMatch[1]) {
        setUsername(usernameMatch[1]);
      }
    }
  }, [pathname]);

  useEffect(() => {
    setMetadata(userPastActivity?.metadata);
  }, [userPastActivity]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const { data: userStats, isLoading: isLoadingStats } =
    useFetchUserStatsDataQuery(username);

  const handleShareClick = () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/ambassador-dao/public-profile?username=${username}`;

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
      ? `@${userDetails.username || username}`
      : `${username}`,
    location: userDetails?.location || "Not specified",
    tier: userDetails?.tier?.name || "",
    skills: userDetails?.skills || [],
    socials: userDetails?.social_links || [],
    profile_image: userDetails?.profile_image || null,
    wallet_address: userDetails?.wallet_address,
    stats: {
      earned: userStats?.total_earnings || 0,
      submissions: userStats?.total_submissions || 0,
      applications: userStats?.total_applications || 0,
      bounty: userStats?.total_bounties_won || 0,
    },
  };

  if (isLoadingDetails || isLoadingStats) {
    return (
      <div className="bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] min-h-screen flex justify-center items-center">
        <FullScreenLoader />
      </div>
    );
  }


  const goToDetails = (type: string, id: string) => {
    const path =
      type === "JOB"
        ? `/ambassador-dao/jobs/${id}`
        : `/ambassador-dao/${type.toLowerCase()}/${id}`;
    window.open(path, "_blank");
  };

  return (
    <div className="bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <div className="border rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b-2 pb-8">
          <div className="flex items-center mb-4 md:mb-0">
              <div className="w-16 h-16 rounded-full mr-4 overflow-hidden">
                <Image
                  src={profile?.profile_image || Avatar}
                  width={40}
                  height={40}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <h2 className="text-sm md:text-base !text-white font-medium">
                    {profile.name}
                  </h2>
                  <p className="text-[var(--secondary-text-color)] text-sm">
                    {profile.username}
                  </p>
                  {profile?.tier && <div className="block sm:flex justify-start items-start bg-[#FB2C3633] rounded-[4px]">
                    <p className="text-[#FB2C36] text-xs px-3 py-1 font-medium">
                      {profile?.tier}
                    </p>
                  </div>}
                </div>
                <p
                  className="text-[#FB2C36] ] text-sm underline"
                  title={profile?.wallet_address}
                >
                  {truncateAddress(profile.wallet_address)}
                </p>
              </div>
            </div>
            <div className="flex space-x-3 relative">
              <button
                onClick={handleShareClick}
                className="border border-[var(--default-border-color)] hover:bg-[var(--default-border-color)] text-[var(--primary-text-color)] px-4 py-2 rounded-md"
              >
                {copySuccess ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h3 className="text-3xl font-medium mb-2">Details</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.location && (
                  <p className="text-[var(--secondary-text-color)] text-xs">
                    Base in: {profile.location}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-medium mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.skills?.length > 0 ? (
                  profile?.skills?.map(
                    (skill: { name: string; id: number }, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 bg-[#F5F5F9] text-[#161617] py-1 rounded-full"
                      >
                        {skill.name}
                      </span>
                    )
                  )
                ) : (
                  <span className="text-[var(--secondary-text-color)]">
                    No skills listed
                  </span>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-medium mb-2">Socials</h3>
              <div className="flex flex-wrap gap-2">
                {profile.socials.length > 0 ? (
                  profile.socials.map((social: string, index: number) => (
                    <div
                      key={index}
                      className="text-xs px-2 py-1 rounded-full text-center bg-[#F5F5F9] text-[#161617] border border-[var(--default-border-color)]"
                    >
                      {social.slice(0, 20)}
                    </div>
                  ))
                ) : (
                  <span className="text-[var(--secondary-text-color)]">
                    No socials listed
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6 text-center mt-1">
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.earned}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Earned
                </p>
              </div>
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.submissions}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Submissions
                </p>
              </div>
              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.applications}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Job
                </p>
              </div>

              <div>
                <h2 className="text-3xl font-medium mb-3">
                  {profile.stats.bounty}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Bounty
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border w-full rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-medium my-4">User Activity</h2>
          <hr className="mb-8 mt-10" />
          {isLoadingPastActivities && <Loader />}
          {!isLoadingPastActivities && userPastActivity?.data?.length === 0 && (
            <div className="flex justify-center items-center">
              No past activities
            </div>
          )}
          {!isLoadingPastActivities &&
            userPastActivity?.data &&
            userPastActivity?.data?.length > 0 &&
            userPastActivity?.data?.map(
              (
                activity: {
                  opportunity: {
                    type: string;
                    id: string;
                    title: string;
                    description: string;
                  };
                  action: string;
                  image: string;
                },
                index: number
              ) => (
                <div
                  key={index}
                  className="flex items-center mb-4 cursor-pointer"
                  onClick={() =>
                    goToDetails(
                      activity?.opportunity?.type,
                      activity?.opportunity?.id
                    )
                  }
                >
                  <div>
                    <div className="rounded-lg w-full bg-[#27272A]">
                      <Image
                        src={
                          activity.opportunity?.type === "JOB" ? Tone : Halftone
                        }
                        alt="Portfolio item"
                        className="p-3  w-full"
                      />
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                      <h3 className="font-medium text-[var(--primary-text-color)] text-2xl">
                        {username}{" "}
                        {activity?.action}
                      </h3>
                      <p className="var(--secondary-text-color) text-sm flex items-center">
                        View
                        <ArrowRight
                          size={16}
                          color="var(--primary-text-color)"
                        />
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
        </div>
        {userPastActivity?.metadata?.last_page > 1 && (
          <Pagination
            metadata={userPastActivity?.metadata}
            onPageChange={handlePageChange}
            className="my-8"
          />
        )}
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
