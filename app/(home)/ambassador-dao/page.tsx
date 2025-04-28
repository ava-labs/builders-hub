"use client";

import Image from "next/image";
import { Suspense } from "react";
import Team1 from "@/public/ambassador-dao-images/Avalanche-team1.png";

import React from "react";

import MainContent from "@/components/ambassador-dao/dashboard/MainContent";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";

const WelcomeSection = ({ user }: { user: any }) => {
  return (
    <div className='relative bg-gradient-to-r from-[#000] to-[#FF394A40] overflow-hidden backdrop-blur-[200px]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center'>
        <div className='relative z-10'>
          {user && (
            <>
              <h1 className='text-2xl sm:text-4xl font-bold text-red-500 mb-2'>
                Welcome back, {user?.first_name}
              </h1>
              <p className='text-sm sm:text-xl text-white'>
                We're so glad to have you on Team 1
              </p>
            </>
          )}

          {!user && (
            <>
              <h1 className='text-2xl sm:text-4xl font-bold text-red-500 mb-2'>
                Welcome to Team 1
              </h1>
              <p className='text-sm sm:text-xl text-white'>
                Hire Elite Blockchain Talent or Get Hired <br /> Your Gateway to
                Web3 Opportunities
              </p>
            </>
          )}
        </div>
        <div className='h-full'>
          <Image
            src={Team1}
            alt='Avalanche Logo'
            className='h-full object-cover'
            width={370.16}
            height={383}
          />
        </div>
      </div>
    </div>
  );
};

const AmbasssadorDao = () => {
  const { data: user, isLoading } = useFetchUserDataQuery();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <div className='bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] min-h-screen'>
      <WelcomeSection user={user} />
      <main className='max-w-7xl mx-auto px-4 sm:px-6 xl:px-8 py-12'>
        <Suspense fallback={<div>Loading...</div>}>
          <MainContent user={user} />
        </Suspense>
      </main>
    </div>
  );
};

export default AmbasssadorDao;
