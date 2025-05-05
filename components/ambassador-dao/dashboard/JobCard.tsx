import { BriefcaseBusiness, FileText, Hourglass } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { IJobDataType } from "@/services/ambassador-dao/interfaces/opportunity";
import { Outline } from "../ui/Outline";
import { getTimeLeft } from "@/utils/timeFormatting";
import Token from "@/public/images/usdcToken.svg";

export const JobCard = ({ job }: IJobDataType) => {
  const { id, title, created_by, total_budget, end_date, skills, _count } = job;

  const router = useRouter();

  const goToDetailsPage = () => {
    router.push(`/ambassador-dao/jobs/${id}`);
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
                <p className="text-[var(--secondary-text-color)]">
                  {created_by?.company_profile?.name}
                </p>
                <div className="flex sm:items-center space-x-1 mt-2">
                  <div className="flex items-center text-xs text-[var(--secondary-text-color)]">
                    <BriefcaseBusiness
                      color="#9F9FA9"
                      className="w-3 h-3 mr-1"
                    />
                    Jobs
                  </div>
                  {/* <div className='flex items-center text-sm text-[var(--secondary-text-color)]'>
                    <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                    {getTimeLeft(end_date) === "Expired"
                      ? "Closed"
                      : `Due in: ${getTimeLeft(end_date)}`}
                  </div> */}
                  <div className="flex items-center text-xs text-[var(--secondary-text-color)]">
                    <FileText color="#9F9FA9" className="w-3 h-3 mr-1" />
                    {_count?.applications}{" "}
                    {_count?.applications > 1 ? "Applications" : "Application"}
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
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between items-center w-full gap-3">
        <div className="flex flex-wrap gap-2 sm:gap-3 text-xs max-w-[60%] sm:max-w-[80%]">
          {skills?.map((skill, index) => (
            <div key={index}>
              <Outline label={skill.name} />
            </div>
          ))}
        </div>

        {parseFloat(total_budget) > 0 && (
          <div className="shrink-0 sm:hidden">
            <span className="text-[#FFFFFF] bg-[#162456] border border-[#2B7FFF] rounded-md p-2 flex items-center gap-1 text-xs">
              <Image src={Token} alt="$" />
              {parseFloat(total_budget).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
