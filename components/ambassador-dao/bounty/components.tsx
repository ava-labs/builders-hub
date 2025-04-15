"use client";

import { useState, Key } from "react";
import {
  FileText,
  Hourglass,
  CircleUser,
  BriefcaseBusiness,
  Loader2,
} from "lucide-react";
import { Outline } from "@/components/ambassador-dao/ui/Outline";
import { useCheckBountyStatus } from "@/services/ambassador-dao/requests/opportunity";
import { getTimeLeft } from "@/utils/timeFormatting";
import { useCountdown } from "@/components/ambassador-dao/hooks/useCountdown";
import Image from "next/image";
import Token from "@/public/ambassador-dao-images/token.png";
import { getOrdinalPosition } from "@/utils/getOrdinalPosition";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { BountySubmissionModal } from "@/components/ambassador-dao/bounty/BountySubmissionModal";
import { AuthModal } from "@/components/ambassador-dao/sections/auth-modal";
import ReactMarkdown from "react-markdown";
import OnboardModal from "../ui/OnboardModal";

interface BountyHeaderProps {
  bounty: {
    id: string;
    title: string;
    companyName: string;
    companyLogo?: string;
    createdBy: string;
    type?: string;
    deadline: string;
    skills: Array<{ name: string } | string>;
    _count: {
      submissions: number;
    };
  };
}

interface BountyDescriptionProps {
  data: {
    title: string;
    content: string[];
  };
}

interface BountySidebarProps {
  nullAction?: boolean;
  bounty: {
    id: string;
    category: string;
    status: string;
    total_budget: number;
    deadline: string;
    proposalsCount: number;
    skills: Array<{ name: string }>;
    custom_questions: any[];
    prize_distribution?: Array<{
      amount: number;
      position: number;
    }>;
  };
}

export const BountyHeader: React.FC<BountyHeaderProps> = ({ bounty }) => {
  return (
    <div className="border border-[var(--default-border-color)] p-4 mb-6 rounded-lg">
      <div className="flex items-center gap-5">
        {bounty.companyLogo ? (
          <img
            src={bounty.companyLogo}
            alt={bounty.companyName}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <CircleUser color="#9F9FA9" size={56} />
        )}
        <div className="mb-6">
          <h1 className="text-base font-bold text-red-500 mb-2">
            {bounty.title}
          </h1>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[var(--secondary-text-color)] text-sm">
                {bounty.companyName}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-md mt-2">
            <div className="flex items-center gap-2 text-sm text-[var(--secondary-text-color)]">
              <BriefcaseBusiness size={16} color="#9F9FA9" />
              <span className="capitalize">{bounty.type?.toLowerCase()}</span>
            </div>
            {/* <div className='flex items-center gap-2 text-sm text-[var(--secondary-text-color)]'>
              <Hourglass size={16} color='#9F9FA9' />
              <span>
                {getTimeLeft(bounty?.deadline) === "Expired"
                  ? "Closed"
                  : `Due in: ${getTimeLeft(bounty?.deadline)}`}
              </span>
            </div> */}
            <div className="flex items-center gap-2 text-sm text-[var(--secondary-text-color)]">
              <FileText size={16} color="#9F9FA9" />
              <span>
                {bounty?._count?.submissions}{" "}
                {bounty?._count?.submissions > 1 ? "Proposals" : "Proposal"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {bounty.skills.length > 0 ? (
              bounty.skills.map(
                (skill: { name: string } | string, index: Key) => (
                  <div key={index}>
                    <Outline
                      label={typeof skill === "string" ? skill : skill.name}
                    />
                  </div>
                )
              )
            ) : (
              <span className="text-[var(--secondary-text-color)] text-sm">
                No skills specified
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BountyDescription: React.FC<BountyDescriptionProps> = ({
  data,
}) => {
  return (
    <div className="mb-6 text-[var(--secondary-text-color)]">
      <h2 className="text-xl font-semibold mb-2 text-white">{data.title}</h2>
      <div className="space-y-4">
        <ReactMarkdown
          components={{
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />
            ),
          }}
        >
          {data?.content?.join("\n\n")}
        </ReactMarkdown>
      </div>
    </div>
  );
};

// export const BountySidebar: React.FC<BountySidebarProps> = ({
//   bounty,
//   nullAction,
// }) => {
//   const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
//   const [isOnboardModalOpen, setIsOnboadModalOpen] = useState<boolean>(false);

//   const timeLeft = useCountdown(bounty?.deadline);
//   const [openAuthModal, setOpenAuthModal] = useState(false);

//   const { data, isLoading } = useCheckBountyStatus(bounty.id);
//   const { data: userData } = useFetchUserDataQuery();

//   return (
//     <div className='bg-transparent p-4 rounded-md border border-[var(--default-border-color)] sticky top-6'>
//       <div className='flex items-center justify-between mb-4'>
//         <div className='flex items-center gap-2'>
//           <span className='text-[var(--white-text-color)] flex items-center gap-2'>
//             <Image src={Token} alt='$' />
//             {bounty?.total_budget} USDC
//           </span>
//         </div>
//       </div>

//       {bounty?.prize_distribution &&
//         bounty?.prize_distribution?.map(
//           (prize: { amount: number; position: number }, index: number) => (
//             <div key={index} className='flex items-center gap-2 my-2'>
//               <Image src={Token} alt='$' />
//               {prize.amount} USDC{" "}
//               <span className='text-[var(--secondary-text-color)]'>
//                 {getOrdinalPosition(prize.position)}
//               </span>
//             </div>
//           )
//         )}

//       <div className='flex gap-4 items-center mb-6 mt-2'>
//         <div className='flex flex-col'>
//           <span className='text-[var(--white-text-color)] flex items-center'>
//             <BriefcaseBusiness
//               size={16}
//               className='inline mr-1'
//               color='#9F9FA9'
//             />
//             <span>{bounty?.proposalsCount}</span>
//           </span>
//           <span className='text-[var(--secondary-text-color)] text-sm'>
//             {bounty?.proposalsCount > 1 ? "Proposals" : "Proposal"}
//           </span>
//         </div>
//         {/* <div className='flex flex-col justify-center'>
//           <span className='text-[var(--white-text-color)] flex items-center'>
//             <Hourglass size={16} className='inline mr-1' color='#9F9FA9' />
//             <span>{timeLeft}</span>
//           </span>
//           <span className='text-[var(--secondary-text-color)] text-sm'>
//             Remaining
//           </span>
//         </div> */}
//       </div>

//       <div className='mb-6'>
//         <h2 className='text-lg font-medium mb-3 text-[var(--primary-text-color)]'>
//           SKILL NEEDED
//         </h2>
//         {bounty?.skills?.length > 0 ? (
//           <div className='flex flex-wrap gap-2'>
//             {bounty?.skills?.map((skill: { name: string }, index: number) => (
//               <div key={index}>
//                 <Outline label={skill.name} />
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className='text-[var(--secondary-text-color)] text-sm'>
//             No skills available
//           </div>
//         )}
//       </div>

//       {(bounty.category === "AMBASSADOR_SPECIFIC" &&
//         userData?.role !== "AMBASSADOR") ||
//       userData?.role === "SPONSOR" ? null : bounty.status === "PUBLISHED" ? (
//         <button
//           disabled={data?.has_submitted}
//           className={`w-full font-medium py-3 rounded-md transition ${
//             data?.has_submitted
//               ? "bg-gray-400 text-[var(--white-text-color)] cursor-not-allowed"
//               : "bg-red-500 hover:bg-red-600 text-white"
//           }`}
//           onClick={() => {
//             if (nullAction) return;

//             if (!userData) {
//               setOpenAuthModal(true);
//               return;
//             }
//             if (
//               !userData?.role ||
//               !userData?.username ||
//               !userData?.wallet_address
//             ) {
//               setIsOnboadModalOpen(true);
//               return;
//             }

//             if (!data?.has_submitted) {
//               setIsModalOpen(true);
//             }
//           }}
//         >
//           {isLoading ? (
//             <div className='flex items-center justify-center'>
//               <Loader2 color='var(--white-text-color)' />
//             </div>
//           ) : data?.has_submitted ? (
//             "Already Submitted"
//           ) : (
//             "Participate"
//           )}
//         </button>
//       ) : null}

//       <AuthModal
//         isOpen={openAuthModal}
//         onClose={() => setOpenAuthModal(false)}
//         stopRedirection={true}
//       />

//       {isModalOpen && (
//         <BountySubmissionModal
//           id={bounty.id}
//           isOpen={isModalOpen}
//           onClose={() => setIsModalOpen(false)}
//         />
//       )}

//       {isOnboardModalOpen && (
//         <OnboardModal
//           isOpen={isOnboardModalOpen}
//           onClose={() => setIsOnboadModalOpen(false)}
//         />
//       )}
//     </div>
//   );
// };

export const BountySidebar: React.FC<BountySidebarProps> = ({
  bounty,
  nullAction,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isOnboardModalOpen, setIsOnboadModalOpen] = useState<boolean>(false);

  const timeLeft = useCountdown(bounty?.deadline);
  const [openAuthModal, setOpenAuthModal] = useState(false);

  const { data, isLoading } = useCheckBountyStatus(bounty.id);
  const { data: userData } = useFetchUserDataQuery();

  return (
    <div className="bg-transparent p-4 rounded-md border border-[var(--default-border-color)] sticky top-6">
      {/* Total budget section */}
      <div className="flex items-center gap-2 mb-4">
        <Image src={Token} alt="$" className="mr-2" />
        <span className="text-[var(--white-text-color)] text-lg font-semibold">
          {bounty?.total_budget} USDC
        </span>
        <span className="text-[var(--secondary-text-color)] ml-1">
          Total Prizes
        </span>
      </div>

      {/* Prize distribution section */}
      {bounty?.prize_distribution && bounty.prize_distribution.length > 0 && (
        <div className="relative pl-10 mb-4">
          {/* Vertical line connecting prizes */}
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#9F9FA9]"></div>

          {bounty.prize_distribution.map(
            (prize: { amount: number; position: number }, index: number) => (
              <div key={index} className="flex items-center my-4 relative">
                <div className="absolute left-[-34px] w-3 h-3 bg-[#9F9FA9] rounded-full"></div>
                <span className="text-[var(--white-text-color)] text-xl font-medium">
                  {prize.amount} USDC
                </span>
                <span className="text-[var(--secondary-text-color)] ml-2">
                  {getOrdinalPosition(prize.position)}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* Proposals and time remaining section */}
      <div className="flex gap-8 items-center mb-6 mt-4">
        <div className="flex items-start">
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 text-[var(--white-text-color)]">
              <FileText size={14} className="mx-auto" color="#FAFAFA" />
              {bounty?.proposalsCount}
            </span>
            <span className="text-[var(--secondary-text-color)] text-sm">
              {bounty?.proposalsCount > 1 ? "Proposals" : "Proposal"}
            </span>
          </div>
        </div>
        <div className="flex items-start">
          <div className="flex flex-col">
            <span className="flex gap-1 items-center text-[var(--white-text-color)]">
          <Hourglass size={14} color="#FAFAFA" />

              {timeLeft}
              </span>
            <span className="text-[var(--secondary-text-color)] text-sm">
              Remaining
            </span>
          </div>
        </div>
      </div>

      {/* Skills section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3 text-[var(--primary-text-color)]">
          SKILL NEEDED
        </h2>
        {bounty?.skills?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bounty.skills.map((skill: { name: string }, index: number) => (
              <div key={index}>
                <Outline label={skill.name} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[var(--secondary-text-color)] text-sm">
            No skills available
          </div>
        )}
      </div>

      {/* Participate button */}
      {(bounty.category === "AMBASSADOR_SPECIFIC" &&
        userData?.role !== "AMBASSADOR") ||
      userData?.role === "SPONSOR" ? null : bounty.status === "PUBLISHED" ? (
        <button
          disabled={data?.has_submitted}
          className={`w-full font-medium py-3 rounded-md transition ${
            data?.has_submitted
              ? "bg-gray-400 text-[var(--white-text-color)] cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
          onClick={() => {
            if (nullAction) return;

            if (!userData) {
              setOpenAuthModal(true);
              return;
            }
            if (
              !userData?.role ||
              !userData?.username ||
              !userData?.wallet_address
            ) {
              setIsOnboadModalOpen(true);
              return;
            }

            if (!data?.has_submitted) {
              setIsModalOpen(true);
            }
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 color="var(--white-text-color)" />
            </div>
          ) : data?.has_submitted ? (
            "Already Submitted"
          ) : (
            "Participate"
          )}
        </button>
      ) : null}

      <AuthModal
        isOpen={openAuthModal}
        onClose={() => setOpenAuthModal(false)}
        stopRedirection={true}
      />

      {isModalOpen && (
        <BountySubmissionModal
          id={bounty.id}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {isOnboardModalOpen && (
        <OnboardModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboadModalOpen(false)}
        />
      )}
    </div>
  );
};
