"use client";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";
import { useFetchLeaderboard } from "@/services/ambassador-dao/requests/sponsor";
import { useState } from "react";
import Image from "next/image";
import Loader from "@/components/ambassador-dao/ui/Loader";
import GoldReward from "@/public/ambassador-dao-images/GoldReward.svg";
import SilverReward from "@/public/ambassador-dao-images/SilverReward.svg";
import BronzeReward from "@/public/ambassador-dao-images/BronzeReward.svg";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";

const LeaderboardPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const { data: leaderboardData, isLoading } = useFetchLeaderboard(currentPage);
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const getRankIcon = (index: number, currentPage: number) => {
    const position = (currentPage - 1) * 10 + index + 1;

    if (position === 1) {
      return (
        <Image src={GoldReward} alt='First Place' width={46} height={46} />
      );
    } else if (position === 2) {
      return (
        <Image src={SilverReward} alt='Second Place' width={46} height={46} />
      );
    } else if (position === 3) {
      return (
        <Image src={BronzeReward} alt='Third Place' width={46} height={46} />
      );
    } else {
      return (
        <div
          className='px-6 py-1 flex items-center justify-center rounded-full bg-[#2F2F33] w-fit'
          style={{
            background: "linear-gradient(90deg, #E84142 0%, #822425 100%)",
          }}
        >
          <span className='text-white'>{position}</span>
        </div>
      );
    }
  };

  return (
    <div className='p-6 '>
      <div className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-[var(--white-text-color)]'>
          Leaderboard
        </h1>
        <p className='text-[var(--secondary-text-color)] hidden md:block'>
          Last updated: {new Date().toLocaleString()}
        </p>
      </div>

      <div className='space-y-2'>
        <div className='grid grid-cols-12 px-4 py-2 text-[var(--secondary-text-color)]'>
          <div className='col-span-3 md:col-span-1'>Rank</div>
          <div className='col-span-6 md:col-span-8'>Name</div>
          <div className='col-span-3 text-right'>XP</div>
        </div>

        {isLoading ? (
          <Loader />
        ) : (
          !!leaderboardData?.data.length &&
          leaderboardData?.data.map((user, index) => (
            <div
              key={user.id}
              className={`grid grid-cols-12 px-4 py-3 my-4 rounded-xl items-center bg-[#171717]`}
              style={{
                background:
                  (currentPage - 1) * 10 + index + 1 === 1
                    ? "linear-gradient(90.38deg, rgba(255, 122, 0, 0.24) 0%, #171717 50.33%)"
                    : (currentPage - 1) * 10 + index + 1 === 2
                    ? "linear-gradient(90.26deg, rgba(172, 166, 190, 0.24) 0%, #171717 50.23%)"
                    : (currentPage - 1) * 10 + index + 1 === 3
                    ? "linear-gradient(90.26deg, rgba(233, 125, 102, 0.24) 0%, #171717 50.23%)"
                    : "#171717",
              }}
            >
              <div className='col-span-3 md:col-span-1'>
                {getRankIcon(index, currentPage)}
              </div>
              <div className='col-span-6 md:col-span-8 flex items-center gap-4'>
                <Image
                  src={DefaultAvatar}
                  alt={user.nickname}
                  width={32}
                  height={32}
                  className='hidden md:block rounded-full'
                />
                <div className='flex flex-col md:flex-row gap-2 md:gap-4 md:items-center'>
                  <span className='text-[var(--white-text-color)] capitalize'>
                    {user.nickname}
                  </span>
                  {user.tag === "ambassador" && (
                    <span className='px-3 py-1 text-xs bg-[#fb2c36e9] dark:bg-[#FB2C3633] text-[#fff] dark:text-[#FB2C36] rounded-md capitalize'>
                      {user.tag}
                    </span>
                  )}
                </div>
              </div>
              <div className='col-span-3 flex justify-end'>
                <p className='bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] text-right rounded-full px-4 py-1 border border-[#171717]'>
                  {" "}
                  {user.points.toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {leaderboardData && (
        <PaginationComponent
          currentPage={currentPage}
          onPageChange={handlePageChange}
          totalPages={leaderboardData.metadata?.last_page ?? 1}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
