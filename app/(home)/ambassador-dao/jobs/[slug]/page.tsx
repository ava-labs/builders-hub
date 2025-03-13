"use client";

import { useState, Suspense } from "react";
import {
  ArrowLeft,
  Clock,
  Briefcase,
  FileText,
  Hourglass,
  MessagesSquare,
  CircleUser,
  BriefcaseBusiness,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Outline } from "@/components/ambassador-dao/ui/Outline";

const GoBackButton = () => {
  const router = useRouter();

  const handleGoBack = () => {
    router.push("/ambassador-dao?type=jobs");
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

const JobHeader = ({ job }: any) => {
  return (
    <div className="border border-[#27272A] p-4 mb-6 rounded-lg">
      <div className="flex items-center gap-5">
        <CircleUser color="#9F9FA9" size={56} />
        <div className="mb-6">
          <h1 className="text-base font-bold text-red-500 mb-2">{job.title}</h1>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">{job.company}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-md">
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <Briefcase size={16} color="#9F9FA9" />
              <span>Jobs</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <Hourglass size={16} color="#9F9FA9" />
              <span>{job.duration}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <FileText size={16} color="#9F9FA9" />
              <span>{job.proposals} Proposals</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array(5)
          .fill(0).map(
              (outline, index) => (
                <div key={index}>
                  <Outline label="Outline" />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


const JobDescription = () => {
  return (
    <div className="mb-6 text-gray-300">
      <h2 className="text-xl font-semibold mb-2 text-white">
        Write a Twitter thread on MuAbout the Job
      </h2>
      <div className="space-y-4">
        <p>
          Create an engaging post on X that drives awareness of Musk.it - a
          $MUSKIT token & community-oriented based project on Solana, backed by
          Erol Musk ( Elon Musk father ) and Musk family members. We are on a
          mission to unite, build and innovate the space.
        </p>
        <p>
          Your post can focus on any aspect of Musk.it, from highlighting our
          token and art narrative to showcasing our cooperation with Erol Musk
          and Musk Institute plans. The goal is to inspire users to explore
          Musk.it and drive curiosity by spreading the word.
        </p>
        <p>
          Participants have the freedom to get creative with their content as
          long as it drives users to check what Musk It is all about!
        </p>
      </div>
    </div>
  );
};

const JobRequirements = () => {
  const requirements = [
    "Publish your post on Twitter/X and tag @JustMuskit in your post",
    "English Language: Submissions must be in English, written fluently, without major grammatical or spelling mistakes.",
    "Media Details: The content should take no more than 5 minutes to consume but all media types are welcome (threads, long posts, articles, videos, etc).",
    "Originality: Only original content is accepted (AI visuals are allowed, but the text must original and authored by you).",
  ];

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 text-white">
        Submission Requirements:
      </h2>
      <ul className="list-disc pl-5 text-gray-300 space-y-2">
        {requirements.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
    </div>
  );
};

const JobRewards = () => {
  const rewards = [
    "1st Place: 400USDC",
    "2nd Place: 200 USDC",
    "3rd Place: 100 USDC",
    "4th Place: 50 USDC",
    "5th Place: 25 USDC",
  ];

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 text-white">Rewards</h2>
      <ul className="list-disc pl-5 text-gray-300 space-y-2">
        {rewards.map((reward, index) => (
          <li key={index}>{reward}</li>
        ))}
      </ul>
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
    // Handle comment submission here
    console.log("Comment submitted:", newComment);
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

const JobSidebar = ({ job }: any) => {
  return (
    <div className="bg-[#111] p-4 rounded-md border border-gray-800 sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center">
            <span className="text-xs">A</span>
          </div>
          <span className="text-white">
            {job.reward} {job.currency}
          </span>
        </div>
      </div>

      <div className="flex gap-4 items-center mb-6">
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
            <span>3h:30m:2s</span>
          </span>
          <span className="text-gray-400 text-sm">Remaining</span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-white">SKILL NEEDED</h2>
        <div className="flex flex-wrap gap-2">
          {Array(4)
          .fill(0).map(
            (skill, index) => (
              <div key={index}>
                <Outline label="Secondary" />
              </div>
            )
          )}
        </div>
      </div>

      <button className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-md transition">
        APPLY
      </button>
    </div>
  );
};



const AmbasssadorDaoSingleJobPage = () => {
  const params = useParams<{ slug: string }>();

  const jobData = {
    id: params.slug,
    title: "Write a Twitter thread on Musk.it project & $MUSKIT token",
    company: "Company Name",
    duration: "Due in 24h",
    proposals: 60,
    reward: 1000,
    currency: "USDC",
  };

  return (
    <div className="text-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 border border-[#27272A] rounded-lg shadow-sm my-6">
        <GoBackButton />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <JobHeader job={jobData} />
            <JobDescription />
            <JobRequirements />
            <JobRewards />
            <CommentsSection comments={mockComments} />
          </div>
          <div className="md:col-span-1">
            <JobSidebar job={jobData} />
          </div>
        </div>
      </div>
    </div>
  );
};

const JobDetailsWithSuspense=()=> {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AmbasssadorDaoSingleJobPage />
    </Suspense>
  );
}

export default JobDetailsWithSuspense;
