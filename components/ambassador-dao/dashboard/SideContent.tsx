import { ArrowUpRight } from "lucide-react";

const UserProfileCard = ({ userData }: any) => {
  return (
    <div className="shadow-sm border border-[#27272A] rounded-lg p-4 mb-6">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gray-600 mr-3 flex items-center justify-center">
          <span className="text-white">
            {userData?.first_name && userData?.last_name
              ? `${userData.first_name.charAt(0)}${userData.last_name.charAt(
                  0
                )}`.toUpperCase()
              : userData?.email
              ? userData?.email?.charAt(0).toUpperCase()
              : ""}
          </span>
        </div>
        <div className="text-sm">
          <h3 className="font-medium text-wrap">
            {userData?.first_name} {userData?.last_name}{" "}
            {!userData?.first_name && userData?.email}
          </h3>
          <p className="text-xs text-gray-400">
            {userData?.username ? `@${userData?.username}` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 rounded-full text-sm">
            {userData?.skills[0]?.name}
          </span>
        </div>
      </div>
    </div>
  );
};

const AmbassadorCard = () => {

const openInNewTab = (url:string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

  return (
    <div
      className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-lg p-4 mb-4 relative overflow-hidden cursor-pointer"
      onClick={() => openInNewTab("https://t.co/dgSO4YUKCD")}
    >
      <div className="relative z-10">
        <h3 className="font-medium mb-1">Become An Ambassador</h3>
        <p className="text-xs opacity-80">
          Reach 70,000+ crypto talent from one single dashboard
        </p>
      </div>
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
        <ArrowUpRight color="white" className="h-6 w-6" />
      </div>
    </div>
  );
};

const SideContent = ({ user }: { user: any }) => {
  return (
    <div className="lg:col-span-1">
      {!user && <AmbassadorCard />}
      {user && <UserProfileCard userData={user} />}
    </div>
  );
};

export default SideContent;
