"use client";
import { PaginationComponent } from "@/components/ambassador-dao/pagination";
import { useFetchLeaderboard } from "@/services/ambassador-dao/requests/sponsor";
import { useEffect, useState } from "react";
import Image from "next/image";
import Loader from "@/components/ambassador-dao/ui/Loader";
import GoldReward from "@/public/ambassador-dao-images/GoldReward.svg";
import SilverReward from "@/public/ambassador-dao-images/SilverReward.svg";
import BronzeReward from "@/public/ambassador-dao-images/BronzeReward.svg";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import Avalance3d from "@/public/ambassador-dao-images/3d.png";
import EmptyWhite from "@/public/ambassador-dao-images/emptyWhite.png";
import { Input } from "@/components/ui/input";

const LeaderboardPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { data: leaderboardData, isLoading } = useFetchLeaderboard(
    currentPage,
    debouncedQuery
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const getRankIcon = (index: number, currentPage: number) => {
    const position = (currentPage - 1) * 10 + index + 1;
    return (
      <div
        className='px-6 py-1 flex items-center justify-center rounded-full bg-[#2F2F33] w-fit'
        style={{
          background: "linear-gradient(90deg, #E84142 0%, #822425 100%)",
        }}
      >
        <span className='text-white text-sm'>{position}</span>
      </div>
    );
  };

  return (
    <div className='bg-[var(--default-background-color)] rounded-md text-[var(--white-text-color)] m-4 md:m-6 border border-[var(--default-border-color)] p-3 md:p-6 lg:p-8'>
      <div className='flex justify-between items-center mb-8'>
        <div>
          <h1 className='text-3xl font-bold text-[var(--white-text-color)]'>
            Leaderboard
          </h1>
          <p className='text-[var(--secondary-text-color)] hidden md:block'>
            Last updated:{" "}
            {new Date().toLocaleString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: false,
            })}
          </p>
        </div>

        <div>
          <Input
            placeholder='Search...'
            className='bg-[var(--default-background-color)] border-[var(--default-border-color)] focus:ring-[#27272A]'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <div className='grid grid-cols-12 px-4 py-2 text-[var(--secondary-text-color)]'>
          <div className='col-span-3 md:col-span-1'>Rank</div>
          <div className='col-span-6 md:col-span-8'>Name</div>
          <div className='col-span-3 text-right'>XP</div>
        </div>

        {isLoading ? (
          <Loader />
        ) : !!leaderboardData?.data.length ? (
          <>
            {leaderboardData?.data.map((user, index) => (
              <div
                key={user.id}
                className={`grid grid-cols-12 px-4 py-3 my-4 rounded-xl items-center bg-gray-300 dark:bg-[#171717]`}
                style={{
                  background:
                    (currentPage - 1) * 10 + index + 1 === 1
                      ? "linear-gradient(90.38deg, rgba(255, 122, 0, 0.24) 0%, #171717 50.33%)"
                      : (currentPage - 1) * 10 + index + 1 === 2
                      ? "linear-gradient(90.26deg, rgba(172, 166, 190, 0.24) 0%, #171717 50.23%)"
                      : (currentPage - 1) * 10 + index + 1 === 3
                      ? "linear-gradient(90.26deg, rgba(233, 125, 102, 0.24) 0%, #171717 50.23%)"
                      : "",
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
                    <span className='text-[var(--white-text-color)] capitalize w-32 lg:w-full truncate'>
                      {user.nickname}
                    </span>
                    {user.tag === "ambassador" && (
                      <span className='px-3 py-1 w-fit text-xs bg-[#fb2c36e9] dark:bg-[#FB2C3633] text-[#fff] dark:text-[#FB2C36] rounded-md capitalize'>
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
            ))}
          </>
        ) : (
          <>
            <div className='max-w-lg mx-auto p-2 my-6'>
              <div className='hidden dark:block'>
                <Image
                  src={Avalance3d}
                  objectFit='contain'
                  alt='avalance icon'
                />
              </div>
              <div className='block dark:hidden'>
                <Image src={EmptyWhite} objectFit='contain' alt='empty icon' />
              </div>

              <div className='my-2'>
                <h2 className='text-[var(--white-text-color)] text-2xl text-center font-medium'>
                  No Data!
                </h2>
                <p className='text-[var(--secondary-text-color)] text-sm text-center'>
                  Check back later for updates on the leaderboard.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {!!leaderboardData?.data.length && (
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
