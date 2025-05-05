import { IBountyDataType } from "@/services/ambassador-dao/interfaces/opportunity";
import { getTimeLeft } from "@/utils/timeFormatting";
import { FileText, Hourglass, Lightbulb } from "lucide-react";
import Image from "next/image";
import Team1 from "@/public/ambassador-dao-images/Avalanche-team1.png";
import { useRouter } from "next/navigation";
import { Outline } from "../ui/Outline";
import Token from "@/public/images/usdcToken.svg";
import XP from "@/public/ambassador-dao-images/sparkles.svg";

export const BountyCard = ({ bounty }: IBountyDataType) => {
  const {
    id,
    title,
    created_by,
    total_budget,
    end_date,
    xp_allocated,
    skills,
    _count,
  } = bounty;
  const router = useRouter();

  const goToDetailsPage = () => {
    router.push(`/ambassador-dao/bounty/${id}`);
  };

  return (
    <div
      className="border border-[var(--default-border-color)] rounded-lg p-4 hover:text-red-500 hover:border-red-500 transition-colors cursor-pointer"
      onClick={goToDetailsPage}
    >
      <div>
        <div className="flex justify-between mb-4">
          <div>
            <div className="flex items-start gap-2 md:gap-5">
              {created_by?.company_profile?.logo && (
                <Image
                  src={created_by?.company_profile?.logo}
                  alt=""
                  className="w-6 h-6 md:w-16 md:h-16  object-cover rounded-full"
                  width={60}
                  height={60}
                />
              )}
              <div>
                <h3 className="text-lg font-medium truncate max-w-[150px] sm:max-w-[350px]">
                  {title}
                </h3>
                <p className="text-gray-400">
                  {created_by?.company_profile?.name}
                </p>
                <div className="flex sm:items-center space-x-1 mt-2">
                  <div className="flex items-center text-xs text-[var(--secondary-text-color)]">
                    <Lightbulb color="#9F9FA9" className="w-3 h-3 mr-1" />
                    Bounty
                  </div>
                  <div className="flex items-center text-xs text-[var(--secondary-text-color)]">
                    <Hourglass color="#9F9FA9" className="w-3 h-3 mr-1" />

                    {getTimeLeft(end_date) === "Expired"
                      ? "Closed"
                      : `Due in: ${getTimeLeft(end_date)}`}
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <FileText color="#9F9FA9" className="w-3 h-3 mr-1" />
                    {_count?.submissions}{" "}
                    {_count?.submissions > 1 ? "Proposals" : "Proposal"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center">
            {parseFloat(total_budget) > 0 && (
              <span className="text-[#FFFFFF] bg-[#162456] border border-[#2B7FFF] rounded-md p-2 flex items-center gap-1 shrink-0 text-xs">
                <Image src={Token} alt="$" />
                {parseFloat(total_budget).toLocaleString()}
              </span>
            )}
            {/* {xp_allocated > 0 && (
              <span className="hidden text-[#FFFFFF] bg-[#27272A] border border-[#D4D4D8] rounded-md p-2 items-center gap-1 shrink-0 text-xs">
                <Image src={XP} alt="$" />
                {xp_allocated} XP
              </span>
            )} */}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between items-center w-full gap-3">
        <div className="flex flex-wrap gap-2 sm:gap-3 text-xs max-w-[60%] sm:max-w-full">
          {skills?.map((skill, index) => (
            <div key={index}>
              <Outline label={skill.name} />
            </div>
          ))}
        </div>

        <div>
          {parseFloat(total_budget) > 0 && (
            <div className="shrink-0 sm:hidden">
              <span className="text-[#FFFFFF] bg-[#162456] border border-[#2B7FFF] rounded-md p-2 flex items-center gap-1 text-xs">
                <Image src={Token} alt="$" />
                {parseFloat(total_budget).toLocaleString()}
              </span>
            </div>
          )}
          {xp_allocated > 0 && (
            <span className="mt-4 sm:mt-1 text-[#FFFFFF] bg-[#27272A] border border-[#D4D4D8] rounded-md p-2 flex items-center gap-1 shrink-0 text-xs">
              <Image src={XP} alt="$" />
              {xp_allocated} XP
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
