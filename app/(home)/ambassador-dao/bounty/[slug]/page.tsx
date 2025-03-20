"use client";

import {
  useState,
  Suspense,
  Key,
} from "react";
import {
  ArrowLeft,
  FileText,
  Hourglass,
  MessagesSquare,
  CircleUser,
  BriefcaseBusiness,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Outline } from "@/components/ambassador-dao/ui/Outline";
import { BountySubmissionModal } from "@/components/ambassador-dao/bounty/BountySubmissionModal";
import {
  useFetchOpportunityComment,
  useFetchOpportunityDetails,
} from "@/services/ambassador-dao/requests/opportunity";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { getTimeLeft } from "../../../../../utils/timeFormatting";
import { useCountdown } from "@/components/ambassador-dao/hooks/useCountdown";
import { getOrdinalPosition } from "../../../../../utils/getOrdinalPosition";
import Image from "next/image";
import Token from "@/public/ambassador-dao-images/token.png";


const GoBackButton = () => {
  const router = useRouter();
  const handleGoBack = () => {
    router.push("/ambassador-dao?type=bounties");
  };

  return (
    <button
      onClick={handleGoBack}
      className="flex items-center gap-2 text-[#FAFAFA] hover:text-white mb-6 bg-[#1A1A1A] py-2 px-4 rounded-md"
    >
      <ArrowLeft size={16} color="#FAFAFA" />
      <span>Go Back</span>
    </button>
  );
};

const BountyHeader = ({ bounty }: any) => {
  return (
    <div className="border border-[#27272A] p-4 mb-6 rounded-lg">
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
              <span className="text-gray-300 text-sm">
                {bounty.companyName}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-md">
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <BriefcaseBusiness size={16} color="#9F9FA9" />
              <span className="capitalize">{bounty.type?.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <Hourglass size={16} color="#9F9FA9" />
              <span>Due in: {getTimeLeft(bounty?.deadline)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <FileText size={16} color="#9F9FA9" />
              <span>{bounty.proposalsCount} Proposals</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {bounty.skills.length > 0 ? (
              bounty.skills.map(
                (skill: { name: any }, index: Key | null | undefined) => (
                  <div key={index}>
                    <Outline label={skill.name || skill} />
                  </div>
                )
              )
            ) : (
              <span className="text-gray-400 text-sm">No skills specified</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
interface BountyDescriptionProps {
  data: {
    title: string;
    content: string[];
  };
}

const BountyDescription: React.FC<BountyDescriptionProps> = ({ data }) => {
  return (
    <div className="mb-6 text-gray-300">
      <h2 className="text-xl font-semibold mb-2 text-white">{data.title}</h2>
      <div className="space-y-4">
        {data?.content?.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
};

const mockComments = [
  {
    id: 1,
    author: "Age Krupa",
    text: "Hello I have create a promo video for send it and sded it on twitter and youtube alike https://x.com/a/ejdacjfdau. https://youtu.be/UHTTOQUR.",
  },
  {
    id: 2,
    author: "Age Krupa",
    text: "Hello I have create a promo video for send it and sded it on twitter and youtube alike https://x.com/a/ejdacjfdau. https://youtu.be/UHTTOQUR.",
  },
  {
    id: 3,
    author: "Age Krupa",
    text: "Hello I have create a promo video for send it and sded it on twitter and youtube alike https://x.com/a/ejdacjfdau. https://youtu.be/UHTTOQUR.",
  },
  {
    id: 4,
    author: "Age Krupa",
    text: "Hello I have create a promo video for send it and sded it on twitter and youtube alike https://x.com/a/ejdacjfdau. https://youtu.be/UHTTOQUR.",
  },
];

const Comment = ({ comment }: any) => {
  return (
    <div className="p-4 border border-gray-800 rounded-lg my-2">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 flex items-center justify-center">
            <span className="text-white text-sm">
              {comment.author.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-medium text-[#FB2C36]">{comment.author}</h3>
            </div>
            <p className="text-gray-300 text-sm">{comment.text}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              className="hover:border-white text-white px-4 rounded-md text-sm transition"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CommentsSection = ({ comments }: any) => {
  const [newComment, setNewComment] = useState("");

  const handleSubmitComment = (e: any) => {
    e.preventDefault();
    setNewComment("");
  };

  return (
    <div className="mt-8 border-t border-gray-800 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessagesSquare size={16} color="#9F9FA9" />
        <h2 className="text-lg font-semibold">{comments.length} Comments</h2>
      </div>

      <form onSubmit={handleSubmitComment} className="mt-6">
        <textarea
          className="w-full border border-gray-800 rounded-md p-3 text-white resize-none focus:outline-none"
          placeholder="Write Comments"
          rows={1}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        ></textarea>
      </form>

      <div className="space-y-4">
        {comments.map((comment: any, index: any) => (
          <Comment key={index} comment={comment} />
        ))}
      </div>
    </div>
  );
};

const BountySidebar = ({ bounty }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timeLeft = useCountdown(bounty?.deadline);
  return (
    <div className="bg-[#111] p-4 rounded-md border border-gray-800 sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-white flex items-center gap-2">
          <Image src={Token} alt="$"  />
          {bounty?.total_budget} USDC <span className="text-[#9F9FA9]">Total Prizes</span>
          </div>
        </div>
      </div>
      {bounty?.prize_distribution &&
        bounty?.prize_distribution?.map(
          (prize: { amount: string | number | bigint; position: number }, index:number) => (
            <div key={index} className="flex items-center gap-2 my-2">
            <Image src={Token} alt="$"  />
              {prize.amount} USDC <span className="text-[#9F9FA9]">{getOrdinalPosition(prize.position)}</span>
            </div>
          )
        )}

      <div className="flex gap-4 items-center my-6">
        <div className="flex flex-col">
          <span className="text-white flex items-center">
            <BriefcaseBusiness
              size={16}
              className="inline mr-1"
              color="#9F9FA9"
            />
            <span>25-50</span>
          </span>
          <span className="text-gray-400 text-sm">Application</span>
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-white flex items-center">
            <Hourglass size={16} className="inline mr-1" color="#9F9FA9" />
            <span>{timeLeft}</span>
          </span>
          <span className="text-gray-400 text-sm">Remaining</span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3 text-white">SKILL NEEDED</h2>
        {bounty?.skills?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bounty?.skills?.map(
              (skill: any, index: Key | null | undefined) => (
                <div key={index}>
                  <Outline label={skill.name} />
                </div>
              )
            )}
          </div>
        ) : (
          <div>No skills available</div>
        )}
      </div>

      <button
        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-md transition"
        onClick={() => setIsModalOpen(true)}
      >
        Participate
      </button>

      {isModalOpen && (
        <BountySubmissionModal
          id={bounty.id}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

const AmbasssadorDaoSingleBountyPage = () => {
  const params = useParams<{ slug: string }>();

  const { data, isLoading } = useFetchOpportunityDetails(params?.slug);
  // const { data: comments, isLoading: isLoadingComments } = useFetchOpportunityComment(params?.slug);

  const headerData = {
    id: data?.id,
    title: data?.title,
    companyName: data?.created_by?.company_profile?.name || "Unknown",
    companyLogo: data?.created_by?.company_profile?.logo,
    createdBy: `${data?.created_by?.first_name} ${data?.created_by?.last_name}`,
    type: data?.type,
    deadline: data?.end_date,
    proposalsCount: data?.max_winners || 0,
    skills: data?.skills || [],
  };

  const extractDescriptionData = (apiResponse: { description: string }) => {
    const descriptionParagraphs = apiResponse.description
      ? apiResponse.description
          .split("\n\n")
          .filter((para) => para.trim() !== "")
      : [];

    const titleParagraph =
      descriptionParagraphs.length > 0
        ? descriptionParagraphs[0]
        : "About the Bounty";

    const contentParagraphs = descriptionParagraphs.slice(1);

    return {
      title: titleParagraph,
      content: contentParagraphs,
    };
  };

  const sidebarData = {
    id: data?.id,
    total_budget: data?.total_budget,
    deadline: data?.end_date,
    proposalsCount: data?.max_winners || 0,
    skills: data?.skills || [],
    prize_distribution: data?.prize_distribution,
  };

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <div className="text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 border border-[#27272A] rounded-lg shadow-sm my-6">
        <GoBackButton />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 flex flex-col">
            <BountyHeader bounty={headerData} />

            <div className="block md:hidden my-6">
              <BountySidebar bounty={sidebarData} />
            </div>

            <BountyDescription data={extractDescriptionData(data)} />
            <CommentsSection comments={mockComments} />
          </div>

          <div className="hidden md:block md:col-span-1">
            <BountySidebar bounty={sidebarData} />
          </div>
        </div>
      </div>
    </div>
  );
};

const BountyDetailsWithSuspense = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AmbasssadorDaoSingleBountyPage />
    </Suspense>
  );
};
export default BountyDetailsWithSuspense;
