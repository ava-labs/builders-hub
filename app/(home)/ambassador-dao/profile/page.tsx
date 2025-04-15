"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Copy,
  DivideCircle,
  Edit,
  File,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import Token from "@/public/ambassador-dao-images/token.png";
import Avatar from "@/public/ambassador-dao-images/Avatar.svg";
import XP from "@/public/ambassador-dao-images/sparkles.png";
import Image from "next/image";

import {
  useFetchUserDataQuery,
  useFetchUserStatsDataQuery,
} from "@/services/ambassador-dao/requests/auth";
import ClaimXPModal from "@/components/ambassador-dao/profile/xp-modal";
import XpSection from "@/components/ambassador-dao/profile/xp-section";
import ProjectSection from "@/components/ambassador-dao/profile/project-section";
import { useFetchUserPendingRewards } from "@/services/ambassador-dao/requests/users";
import { useFetchOpportunity } from "@/services/ambassador-dao/requests/opportunity";
import { Pagination } from "@/components/ambassador-dao/ui/Pagination";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { truncateAddress } from "@/utils/truncateAddress";

const AmbasssadorDaoProfilePage = () => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const router = useRouter();
  const { data, isLoading } = useFetchUserDataQuery();

  const userNeedsOnboarding =
    !data?.role ||
    (data?.role === "TALENT" && (!data?.username || !data?.wallet_address));

  useEffect(() => {
    if (!isLoading && userNeedsOnboarding) {
      router.push("/ambassador-dao/onboard");
    }
  }, [isLoading, userNeedsOnboarding, router]);

  const { data: userStats, isLoading: isLoadingStats } =
    useFetchUserStatsDataQuery(
      !userNeedsOnboarding ? data?.username : undefined
    );

  const { data: userPendingRewards, isLoading: isLoadingRewards } =
    useFetchUserPendingRewards(!userNeedsOnboarding ? true : false);

  const { data: opportunities, isLoading: isLoadingOpportunities } =
    useFetchOpportunity(!userNeedsOnboarding ? {} : { enabled: false });

  if (isLoading || userNeedsOnboarding) {
    return <FullScreenLoader />;
  }

  const userRole = data?.role;

  const profile = {
    name: data ? `${data.first_name || ""} ${data.last_name || ""}` : "-",
    username: data ? `@${data.username}` : `-`,
    location: data?.location || "Not specified",
    skills: data?.skills || "-",
    socials: data?.social_links || null,
    profile_image: data?.profile_image || null,
    wallet_address: data?.wallet_address,
    tier: data?.tier?.name,
    stats: {
      earned: userStats?.total_earnings || 0,
      submissions: userStats?.total_submissions || 0,
      bounty: userStats?.total_bounties_won || 0,
      job: userStats?.total_applications || 0,
    },
  };

  const xpProgressionData = {
    currentXP: data?.points?.balance,
    monthlyGrowth: 850,
    availableOpportunities: opportunities?.data,
  };

  const handleShareClick = () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/ambassador-dao/profile/username=${data?.username}`;

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <div className="border rounded-lg p-6 mb-6">
          <div className="flex flex-row justify-between items-start md:items-center mb-8 border-b-2 pb-8">
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
                  <h2 className="text-sm md:text-base !text-white font-medium">{profile.name}</h2>
                  <p className="text-[var(--secondary-text-color)] text-sm">
                    {profile.username}
                  </p>
                  <div className="block sm:flex justify-start items-start bg-[#FB2C3633] rounded-[4px]">
                    <p className="text-[#FB2C36] text-xs px-3 py-1 font-medium">
                      {profile?.tier}
                    </p>
                  </div>
                </div>
                <p className="text-[#FB2C36] ] text-sm underline" title={profile?.wallet_address}>
                  {truncateAddress(profile.wallet_address)}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/ambassador-dao/edit-profile"
                className="flex sm:hidden text-white p-2 rounded-md bg-[#FF394A]"
              >
                <Edit color="#FFF" />
              </Link>
              <Link
                href="/ambassador-dao/edit-profile"
                className="hidden sm:flex bg-[#FF394A] text-white px-4 py-2 rounded-md"
              >
                Edit Profile
              </Link>

              <button
                onClick={handleShareClick}
                className="flex sm:hidden border border-[var(--default-border-color)] hover:bg-[var(--default-border-color)] text-[var(--white-text-color)] p-2 rounded-md"
              >
                <Copy color="#FFF" />
              </button>
              <button
                onClick={handleShareClick}
                className="hidden sm:flex border border-[var(--default-border-color)] hover:bg-[var(--default-border-color)] text-[var(--white-text-color)] px-4 py-2 rounded-md"
              >
                {copySuccess ? "Copied!" : "Share"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                    (skill: { name: string; id: string }) => (
                      <div
                        key={skill.id}
                        className="text-xs px-2 py-1 bg-[#F5F5F9] text-[#161617] rounded-full text-center border border-[var(--default-border-color)]"
                      >
                        {skill.name}
                      </div>
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
                {profile?.socials?.length > 0 ? (
                  profile?.socials?.map((social: string, index: number) => (
                    <div
                      className="text-xs px-2 py-1 bg-[#F5F5F9] text-[#161617] rounded-full text-center border border-[var(--default-border-color)]"
                      key={index}
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
            <div className="grid grid-cols-4 gap-2 sm:gap-x-12 text-center mt-1">
              <div>
                <h2 className="text-base sm:text-2xl font-medium mb-3">
                  {profile.stats.earned}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Earned
                </p>
              </div>
              <div>
                <h2 className="text-base sm:text-2xl font-medium mb-3">
                  {profile.stats.submissions}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Submissions
                </p>
              </div>
              <div>
                <h2 className="text-base sm:text-2xl font-medium mb-3">
                  {profile.stats.job}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Job
                </p>
              </div>
              <div>
                <h2 className="text-base sm:text-2xl font-medium mb-3">
                  {profile.stats.bounty}
                </h2>
                <p className="text-[var(--secondary-text-color)] text-xs">
                  Bounty
                </p>
              </div>
            </div>
          </div>
        </div>

        {userRole === "AMBASSADOR" && <XpSection data={xpProgressionData} />}

        <div className="border rounded-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
            <h2 className="text-2xl mb-8 pb-8 sm:mb-0 sm:pb-0 font-medium border-b border-[#27272A] sm:border-0">
              Reward Pending
            </h2>
            {userRole === "AMBASSADOR" && (
              <button
                className="bg-red-500 h-10  hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm flex items-center"
                onClick={() => setIsModalOpen(true)}
              >
                Verify Event And Claim XP
                <ArrowRight className="ml-2" size={16} color="#FAFAFA" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {userPendingRewards?.data?.map((project: any, index: number) => (
              <div
                key={index}
                className="bg-[#161617] rounded-lg p-4 cursor-pointer"
                onClick={() => {
                  router.push(
                    `/ambassador-dao/${project?.submission?.opportunity?.type?.toLowerCase()}/${
                      project?.submission?.opportunity?.id
                    }`
                  );
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-blue-500 rounded-full mr-3 overflow-hidden">
                      <Image
                        src="/api/placeholder/40/40"
                        alt="Project"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-red-500 font-medium truncate max-w-[150px]">
                        {project?.submission?.opportunity?.title}
                      </h3>
                      <p className="text-[var(--secondary-text-color)] text-xs truncate max-w-[150px]">
                        {project?.submission?.opportunity?.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-16">
                    <div className="flex gap-1 flex-row sm:flex-col sm:items-center">
                      <BriefcaseBusiness size={14} color="#9F9FA9" />
                      <span className="text-xs text-[var(--secondary-text-color)] capitalize">
                        {project?.submission?.opportunity?.type?.toLowerCase()}
                      </span>
                    </div>

                    <div className="flex gap-1 flex-row sm:flex-col sm:items-center">
                      <File size={14} color="#9F9FA9" />
                      <span className="text-xs text-[var(--secondary-text-color)]">
                        {project?.submission?.opportunity?._count
                          ?.submissions ||
                          project?.submission?.opportunity?._count
                            ?.applications}{" "}
                        proposals
                      </span>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap flex-row space-x-3">
                      {project?.submission?.opportunity?.total_budget > 0 && (
                        <div className="flex items-center text-xs">
                          <Image src={Token} alt="$" />
                          <span className="text-[var(--white-text-color)] ml-1 w-max">
                            {`${project?.submission?.opportunity?.total_budget} USDC`}
                          </span>
                        </div>
                      )}
                      {project?.submission?.opportunity?.xp_allocated > 0 && (
                        <div className="flex justify-start text-xs sm:px-2 py-3 rounded-full">
                          <Image src={XP} alt="$" />
                          <span className="text-white">
                            {project?.submission?.opportunity?.xp_allocated} XP
                          </span>
                        </div>
                      )}
                    </div>

                    <button className="bg-blue-600 text-[var(--white-text-color)] text-xs px-3 py-1 rounded-full w-max">
                      Reward Pending
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {userPendingRewards?.data.length === 0 && (
              <div className="flex items-center justify-center">
                No data available
              </div>
            )}

            {userPendingRewards?.metadata.last_page > 1 && (
              <Pagination
                metadata={userPendingRewards?.metadata}
                onPageChange={handlePageChange}
                className="my-8"
              />
            )}
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
