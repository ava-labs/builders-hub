import { BriefcaseBusiness, FileText, Hourglass } from "lucide-react";
import Image from "next/image";
import Team1 from "@/public/ambassador-dao-images/Avalanche-team1.png";
import { useRouter } from "next/navigation";
import { IJobDataType } from "@/services/ambassador-dao/interfaces/opportunity";
import { Outline } from "../ui/Outline";
import { getTimeLeft } from "@/utils/timeFormatting";
import Token from "@/public/ambassador-dao-images/token.png";



export const JobCard = ({ job }: IJobDataType) => {
    const {
      id,
      title,
      created_by,
      total_budget,
      end_date,
      proposals,
      skills,
    } = job;
  
    const router = useRouter();
  
    const goToDetailsPage = () => {
      router.push(`/ambassador-dao/jobs/${id}`);
    };
  
    return (
      <div
        className="border border-gray-700 rounded-lg p-4 hover:border-red-500 transition-colors cursor-pointer"
        onClick={goToDetailsPage}
      >
        <div>
          <div className="flex justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 md:gap-5">
                <Image
                  src={Team1}
                  alt=""
                  className="w-6 h-6 md:w-16 md:h-16  object-cover rounded-full"
                  width={60}
                  height={60}
                />
                <div>
                  <h3 className="text-lg font-medium text-red-500">{title}</h3>
                  <p className="text-gray-400">
                    {created_by?.company_profile?.name}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center space-x-4">
                    <div className="flex items-center text-sm text-gray-400">
                      <BriefcaseBusiness
                        color="#9F9FA9"
                        className="w-3 h-3 mr-1"
                      />
                      Jobs
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                      <Hourglass color="#9F9FA9" className="w-3 h-3 mr-1" />
                      Due in {getTimeLeft(end_date)}
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                      <FileText color="#9F9FA9" className="w-3 h-3 mr-1" />
                      {proposals} Proposals
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-white flex items-center gap-1">
                <Image src={Token} alt="$"  />
                {total_budget}</span>
            </div>
          </div>
        </div>
  
        <div className="mt-4 grid grid-cols-8 gap-2">
          {skills?.map((skill, index) => (
            <div key={index}>
              <Outline label={skill.name} />
            </div>
          ))}
        </div>
      </div>
    );
  };