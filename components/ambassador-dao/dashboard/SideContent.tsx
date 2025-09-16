import { useFetchLeaderboard } from "@/services/ambassador-dao/requests/sponsor";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DefaultAvatar from "@/public/ambassador-dao-images/Avatar.svg";
import SilverReward from "@/public/ambassador-dao-images/SilverReward.svg";
import GoldReward from "@/public/ambassador-dao-images/GoldReward.svg";
import BronzeReward from "@/public/ambassador-dao-images/BronzeReward.svg";
import HowItWorks from "../How-it-works";

const UserProfileCard = ({ userData }: any) => {
  return (
    <div className='shadow-sm border border-[var(--default-border-color)] rounded-lg p-4 mb-6'>
      <div className='flex flex-wrap items-center'>
        <div className='w-10 h-10 rounded-full bg-gray-600 mr-3 flex items-center justify-center'>
          <span className='text-white'>
            {userData?.first_name && userData?.last_name
              ? `${userData.first_name.charAt(0)}${userData.last_name.charAt(
                  0
                )}`.toUpperCase()
              : userData?.email
              ? userData?.email?.charAt(0).toUpperCase()
              : ""}
          </span>
        </div>
        <div className='text-sm'>
          <h3 className='font-medium text-wrap'>
            {userData?.first_name} {userData?.last_name}{" "}
            {!userData?.first_name && userData?.email}
          </h3>
          <p className='text-xs text-[var(--secondary-text-color)]'>
            {userData?.username ? `@${userData?.username}` : ""}
          </p>
        </div>
        <div className='ml-auto'>
          <span className='px-3 py-1 rounded-full text-sm'>
            {userData?.job_title}
          </span>
        </div>
      </div>
    </div>
  );
};

export const AmbassadorCard = ({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) => {
  //   const openInNewTab = (url: string) => {
  //     window.open(url, "_blank", "noopener,noreferrer");
  //   };

  return (
    <>
      {" "}
      <div
        className={`max-w-[592px] ${
          title === "Become a Member" ? "red-card-bg" : "blue-card-bg"
        } rounded-lg p-4 mb-4 relative overflow-hidden cursor-pointer border border-[var(--default-border-color)]`}
        onClick={onClick}
      >
        <div className='relative z-10 text-[var(--white-text-color)]'>
          <h3 className='font-medium mb-1 text-lg md:text-xl text-[var(--white-text-color)]'>
            {title}
          </h3>
          <p className='text-sm opacity-80 text-[var(--secondary-text-color)]'>
            {description}
          </p>
        </div>
        <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
          <ArrowUpRight color='white' className='h-6 w-6' />
        </div>
      </div>
    </>
  );
};

const LeaderboardCard = () => {
  return (
    <Link href={"/ambassador-dao/leaderboard"}>
      {" "}
      <div className='rounded-md trophy mb-4 relative overflow-hidden cursor-pointer dark:border-none border border-[var(--default-border-color)] h-[72px]'>
        <div className='relative z-10 text-[var(--white-text-color)] p-4'>
          <h3 className='font-medium text-lg md:text-xl mb-1 text-[var(--white-text-color)]'>
            Leaderboard
          </h3>
        </div>
        <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
          <ArrowUpRight color='var(--white-text-color)' className='h-6 w-6' />
        </div>
      </div>
    </Link>
  );
};

const SideContent = ({ user }: { user: any }) => {
  const steps = [
    {
      number: 1,
      title: "Create Your Account",
      linkText: "Here",
    },
    {
      number: 2,
      title: "Complete Bounties",
    },
    {
      number: 3,
      title: "Get Paid",
    },
  ];

  const currentPage = 1;
  const { data: leaderboardData, isLoading } = useFetchLeaderboard(currentPage);
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
          <span className='text-[var(--white-text-color)]'>{position}</span>
        </div>
      );
    }
  };

  return (
    <div className='lg:col-span-1'>
      {!user ? <HowItWorks steps={steps} /> : null}

      <LeaderboardCard />
      <>
        {leaderboardData?.data?.slice(0, 3)?.map((user, index) => (
          <div
            key={user.id}
            className={`grid grid-cols-12 px-4 py-3 my-4 rounded-md items-center h-[60px] dark:border-none border border-[var(--default-border-color)] `}
            style={{
              background:
                (currentPage - 1) * 10 + index + 1 === 1
                  ? "linear-gradient(90.38deg, rgba(255, 122, 0, 0.24) 0%, rgba(255, 92, 0, 0) 50.33%)"
                  : (currentPage - 1) * 10 + index + 1 === 2
                  ? "linear-gradient(90.26deg, rgba(172, 166, 190, 0.24) 0%, rgba(172, 166, 190, 0) 50.23%)"
                  : (currentPage - 1) * 10 + index + 1 === 3
                  ? "linear-gradient(90.38deg, rgba(255, 122, 0, 0.24) 0%, rgba(255, 92, 0, 0) 50.33%)"
                  : "",
            }}
          >
            <div className='col-span-1'>{getRankIcon(index, currentPage)}</div>

            <div className='col-span-9 flex items-center gap-4'>
              <Image
                src={DefaultAvatar}
                alt={user.nickname}
                width={32}
                height={32}
                className='hidden md:block rounded-full'
              />
              <span
                className='text-[var(--white-text-color)] text-xs sm:!text-base capitalize truncate max-w-[150px]'
                title={user.nickname}
              >
                {user.nickname}
              </span>
            </div>

            <div className='col-span-2 flex justify-end'>
              {user.tag === "ambassador" && (
                <span className='px-3 py-1 text-xs flex justify-center items-center dark:bg-[#444444] bg-[#e4e4e7] text-[var(--white-text-color)] rounded-md capitalize'>
                  {user.tag}
                </span>
              )}
            </div>
          </div>
        ))}
      </>
      {user && <UserProfileCard userData={user} />}
    </div>
  );
};

export default SideContent;
