"use client";

import Image from "next/image";
import { Suspense } from "react";
import Team1 from "@/public/ambassador-dao-images/Avalanche-team1.png";
import Team1Logo from "@/public/ambassador-dao-images/team1.svg";

import React, { useState } from "react";

import MainContent from "@/components/ambassador-dao/dashboard/MainContent";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { AmbassadorCard } from "@/components/ambassador-dao/dashboard/SideContent";
import { AuthModal } from "@/components/ambassador-dao/sections/auth-modal";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const WelcomeSection = ({ user }: { user: any }) => {
  return (
    <div className='relative bg-welcome overflow-hidden backdrop-blur-[200px] h-full max-h-[340px] sm:max-h-[256px] py-16'>
      <div className='max-w-7xl mx-auto my-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:justify-between sm:items-center'>
        <div className='relative z-10'>
          {user && (
            <>
              <h1 className='text-2xl sm:text-4xl font-normal text-[var(--white-text-color)] mb-2'>
                Welcome back, {user?.first_name}
              </h1>
              <p className='text-md sm:text-xl text-[var(--secondary-text-color)]'>
                We're so glad to have you on Team 1
              </p>
            </>
          )}

          {!user && (
            <>
              <h1 className='text-2xl sm:text-4xl text-[var(--white-text-color)] mb-2'>
                Welcome to Team 1
              </h1>
              <p className='text-md sm:text-xl text-[var(--secondary-text-color)]'>
                Where talent connects with opportunity in the Avalanche
                ecosystem
              </p>
            </>
          )}
        </div>
        {!user && (
          <div className='flex mt-4 sm:mt-0 items-end justify-end'>
            <div className='hidden dark:block'>
              <Image
                src={Team1}
                alt='Avalanche Logo (Dark Mode)'
                className='h-full object-cover'
                width={110}
                height={115}
              />
            </div>
            <div className='block dark:hidden'>
              <Image
                src={Team1Logo}
                alt='Avalanche Logo (Light Mode)'
                className='h-full object-cover'
                width={110}
                height={115}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AmbasssadorDao = () => {
  const { data: user, isLoading } = useFetchUserDataQuery();
  const [openAuthModal, setOpenAuthModal] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  if (isLoading) {
    return <FullScreenLoader />;
  }
  const handleBecomeClient = () => {
    if (!session) {
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
      
    } 
  };
  return (
    <div className='bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] min-h-screen'>
      <WelcomeSection user={user} />
      {!user && (
        <div className='max-w-[1220px] bg-[var(--drop-shadow)] mx-auto px-8 py-8 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 -mt-8  shadow-sm backdrop-blur-xs border-[1px] border-[#FFFFFF66] dark:border-none'>
          {user?.role !== "AMBASSADOR" && (
            <AmbassadorCard
              title='Become a Member'
              description='Reach 70,000+  talent from one single dashboard'
              onClick={() =>
                window.open(
                  "https://job-boards.greenhouse.io/avalabs",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            />
          )}
          {user?.role !== "AMBASSADOR" && (
            <AmbassadorCard
              title='Become a Client'
              description='Post projects and hire top talent for your business needs'
              onClick={handleBecomeClient}
            />
          )}
        </div>
      )}

      <main className='max-w-7xl mx-auto px-4 sm:px-6 xl:px-8 py-12'>
        <Suspense fallback={<div>Loading...</div>}>
          <MainContent user={user} />

          <AuthModal
            isOpen={openAuthModal}
            onClose={() => setOpenAuthModal(false)}
            stopRedirection={false}
          />
        </Suspense>
      </main>
    </div>
  );
};

export default AmbasssadorDao;
