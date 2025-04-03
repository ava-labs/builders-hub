"use client";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";
import { useFetchLeaderboard } from "@/services/ambassador-dao/requests/sponsor";
import { useState } from "react";
import Image from "next/image";
import Loader from "@/components/ambassador-dao/ui/Loader";

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
        <div className='w-8 h-8'>
          <Image
            src='/images/gold-medal.png'
            alt='First Place'
            width={32}
            height={32}
          />
        </div>
      );
    } else if (position === 2) {
      return (
        <div className='w-8 h-8'>
          <Image
            src='/images/silver-medal.png'
            alt='Second Place'
            width={32}
            height={32}
          />
        </div>
      );
    } else if (position === 3) {
      return (
        <div className='w-8 h-8'>
          <Image
            src='/images/bronze-medal.png'
            alt='Third Place'
            width={32}
            height={32}
          />
        </div>
      );
    } else {
      return (
        <div className='w-8 h-8 flex items-center justify-center rounded-full bg-[#2F2F33]'>
          <span className='text-white'>{position}</span>
        </div>
      );
    }
  };

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-white'>Leaderboard</h1>
        <p className='text-gray-400'>
          Last updated: {new Date().toLocaleString()}
        </p>
      </div>

      <div className='space-y-2'>
        <div className='grid grid-cols-12 px-4 py-2 text-gray-400'>
          <div className='col-span-1'>Rank</div>
          <div className='col-span-8'>Name</div>
          <div className='col-span-3 text-right'>XP</div>
        </div>

        {isLoading ? (
          <Loader />
        ) : (
          !!leaderboardData?.data.length &&
          leaderboardData?.data.map((user, index) => (
            <div
              key={user.id}
              className='grid grid-cols-12 px-4 py-3 bg-[#1C1C1F] rounded-lg items-center'
            >
              <div className='col-span-1'>
                {getRankIcon(index, currentPage)}
              </div>
              <div className='col-span-8 flex items-center gap-2'>
                <div className='w-8 h-8 rounded-full overflow-hidden'>
                  <Image
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.clientId}`}
                    alt={user.nickname}
                    width={32}
                    height={32}
                  />
                </div>
                <span className='text-white'>{user.nickname}</span>
                <span className='px-2 py-1 text-xs bg-[#2F2F33] rounded-md'>
                  {user.tag}
                </span>
              </div>
              <div className='col-span-3 text-right text-white'>
                {user.points.toLocaleString()}
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
