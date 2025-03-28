import { IBountyDataType } from "@/services/ambassador-dao/interfaces/opportunity";
import { getTimeLeft } from "@/utils/timeFormatting";
import { FileText, Hourglass, Lightbulb } from "lucide-react";
import Image from "next/image";
import Team1 from "@/public/ambassador-dao-images/Avalanche-team1.png";
import { useRouter } from "next/navigation";
import { Outline } from "../ui/Outline";
import Token from "@/public/images/usdcToken.svg";

export const BountyCard = ({ bounty }: IBountyDataType) => {
  const {
    id,
    title,
    created_by,
    total_budget,
    end_date,
    proposals,
    skills,
    _count,
  } = bounty;
  const router = useRouter();

  const goToDetailsPage = () => {
    router.push(`/ambassador-dao/bounty/${id}`);
  };

  return (
    <div
      className='border border-gray-700 rounded-lg p-4 hover:border-red-500 transition-colors cursor-pointer'
      onClick={goToDetailsPage}
    >
      <div>
        <div className='flex justify-between mb-4'>
          <div>
            <div className='flex items-center gap-2 md:gap-5'>
              <Image
                src={Team1}
                alt=''
                className='w-6 h-6 md:w-16 md:h-16 object-cover rounded-full'
                width={60}
                height={60}
              />
              <div>
                <h3 className='text-lg font-medium text-red-500'>{title}</h3>
                <p className='text-gray-400'>
                  {created_by?.company_profile?.name}
                </p>
                <div className='flex flex-col sm:flex-row sm:items-center space-x-4 mt-2'>
                  <div className='flex items-center text-sm text-gray-400'>
                    <Lightbulb color='#9F9FA9' className='w-3 h-3 mr-1' />
                    Bounty
                  </div>
                  <div className='flex items-center text-sm text-gray-400'>
                    <Hourglass color='#9F9FA9' className='w-3 h-3 mr-1' />
                    Due in {getTimeLeft(end_date)}
                  </div>
                  <div className='flex items-center text-sm text-gray-400'>
                    <FileText color='#9F9FA9' className='w-3 h-3 mr-1' />
                    {_count?.submissions} Proposals
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className='flex items-center'>
            <span className='text-white flex items-center gap-1'>
              <Image src={Token} alt='$' />
              {parseFloat(total_budget).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className='mt-4 flex gap-2 items-center overflow-x-auto'>
        {skills.map((skill, index) => (
          <div key={index}>
            <Outline label={skill.name} />
          </div>
        ))}
      </div>
    </div>
  );
};
