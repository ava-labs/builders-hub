import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

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

const AmbassadorCard = () => {
  const openInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {" "}
      <div
        className='bg-gradient-to-r rounded-lg p-4 mb-4 relative overflow-hidden cursor-pointer'
        onClick={() => openInNewTab("https://t.co/dgSO4YUKCD")}
        style={{
          background:
            "linear-gradient(90deg, rgba(9, 9, 11, 1) 47%, #E84142 100%)",
        }}
      >
        <div className='relative z-10 text-white'>
          <h3 className='font-medium mb-1 text-lg md:text-xl text-red-500'>
            Become An Ambassador
          </h3>
          <p className='text-xs opacity-80'>
            Reach 70,000+ crypto talent from one single dashboard
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
      <div
        className='rounded-lg p-4 mb-4 relative overflow-hidden cursor-pointer'
        style={{
          background:
            "linear-gradient(90deg, rgba(9, 9, 11, 1) 47%, #155DFC 100%)",
        }}
      >
        <div className='relative z-10 text-white'>
          <h3 className='font-medium text-lg md:text-xl mb-1 text-blue-500'>
            Leaderboard
          </h3>
          <p className='text-xs opacity-80'>
            Explore the leaderboard to view top contributors.
          </p>
        </div>
        <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
          <ArrowUpRight color='white' className='h-6 w-6' />
        </div>
      </div>
    </Link>
  );
};

const SideContent = ({ user }: { user: any }) => {
  return (
    <div className='lg:col-span-1'>
      {user?.role !== "AMBASSADOR" && <AmbassadorCard />}
      <LeaderboardCard />
      {user && <UserProfileCard userData={user} />}
    </div>
  );
};

export default SideContent;
