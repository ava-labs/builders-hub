"use client";

import { useState, Suspense, Key, useEffect, useRef } from "react";
import {
  ArrowLeft,
  FileText,
  Hourglass,
  MessagesSquare,
  CircleUser,
  MoreVertical,
  BriefcaseBusiness,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { Outline } from "@/components/ambassador-dao/ui/Outline";
import JobApplicationModal from "@/components/ambassador-dao/jobs/JobApplicationModal";
import {
  useDeleteOpportunityComment,
  useEditOpportunityComment,
  useFetchOpportunityComment,
  useFetchOpportunityDetails,
  useReplyOpportunityComment,
  useSubmitOpportunityComment,
  useFetchOpportunityCommentReplies
} from "@/services/ambassador-dao/requests/opportunity";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { getTimeLeft } from "@/utils/timeFormatting";
import { useCountdown } from "@/components/ambassador-dao/hooks/useCountdown";
import Image from "next/image";
import Token from "@/public/ambassador-dao-images/token.png";
import { getOrdinalPosition } from "@/utils/getOrdinalPosition";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";

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
        {job.companyLogo ? (
          <img
            src={job.companyLogo}
            alt={job.companyName}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <CircleUser color="#9F9FA9" size={56} />
        )}
        <div className="mb-6">
          <h1 className="text-base font-bold text-red-500 mb-2">{job.title}</h1>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">{job.companyName}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 rounded-md">
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <BriefcaseBusiness size={16} color="#9F9FA9" />
              <span className="capitalize">{job.type?.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <Hourglass size={16} color="#9F9FA9" />
              <span>Due in: {getTimeLeft(job?.deadline)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#9F9FA9]">
              <FileText size={16} color="#9F9FA9" />
              <span>{job.proposalsCount} Proposals</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {job.skills.length > 0 ? (
              job.skills.map(
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

interface JobDescriptionProps {
  data: {
    title: string;
    content: string[];
  };
}

const JobDescription: React.FC<JobDescriptionProps> = ({ data }) => {
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

interface CommentProps {
  comment: {
    id: string;
    author: {
      id: string;
      first_name: string;
      last_name: string;
    };
    content: string;
  };
}

const Comment: React.FC<CommentProps> = ({ comment }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const optionsRef = useRef(null);

  const { mutateAsync: editComment } =
    useEditOpportunityComment(comment.id);

    const { mutateAsync: replyComment } =
    useReplyOpportunityComment(comment.id);

  const { mutateAsync: deleteComment } =
    useDeleteOpportunityComment(comment.id);

  const { data } = useFetchUserDataQuery();

  const { data: commentReplies } =
  useFetchOpportunityCommentReplies(comment.id);

  const isEditable = data?.id === comment?.author?.id;

  const handleReplySubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    console.log(`Reply to comment ${comment.id}: ${replyText}`);
    setReplyText("");
    setIsReplying(false);
    replyComment({
      content: replyText,
      parent_id: comment.id
    });
  };

  const handleCancelReply = () => {
    setReplyText("");
    setIsReplying(false);
  };

  const handleEditSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    console.log(`Edit comment ${comment.id}: ${editText}`);
    setIsEditing(false);
    editComment({
      content: editText,
    });
  };

  const handleDeleteComment = () => {
    console.log(`Delete comment ${comment.id}`);
    setShowOptions(false);
    deleteComment();
  };

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (
      optionsRef.current &&
      !(e.target as Node).contains(optionsRef.current as Node) &&
      !(optionsRef.current as HTMLElement).contains(e.target as Node)
    ) {
      setShowOptions(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="p-4 border border-gray-800 rounded-lg my-2 relative">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-3 w-full">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 flex items-center justify-center">
              <span className="text-white text-sm">
                {comment?.author?.first_name?.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1 w-full">
                <h3 className="font-medium text-[#FB2C36]">
                  {comment?.author?.first_name} {comment?.author?.last_name}
                </h3>
                {isEditable && (
                  <button
                    className="p-1 text-gray-400 hover:text-white focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={toggleOptions}
                    aria-label="Comment options"
                  >
                    <MoreVertical size={16} color="#fff" />
                  </button>
                )}

                {showOptions && isEditable && (
                  <div
                    ref={optionsRef}
                    className="absolute right-4 top-12 bg-gray-800 rounded-md shadow-lg z-10 py-1 min-w-[100px]"
                  >
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                      onClick={() => {
                        setIsEditing(true);
                        setShowOptions(false);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-700"
                      onClick={handleDeleteComment}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleEditSubmit} className="mt-2">
                  <textarea
                    className="w-full border border-gray-800 rounded-md p-3 text-white resize-none focus:outline-none bg-gray-900"
                    placeholder="Edit your comment"
                    rows={2}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                  ></textarea>
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditText(comment?.content);
                        setIsEditing(false);
                      }}
                      className="px-4 py-1 text-gray-300 hover:text-white rounded-md text-sm transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-gray-300 text-sm">{comment?.content}</p>
              )}
            </div>
          </div>

          {!isEditing && (
            <div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setIsReplying(!isReplying)}
                  className="hover:text-white text-gray-400 px-4 rounded-md text-sm transition"
                >
                  Reply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="ml-12 mt-4">
            <form onSubmit={handleReplySubmit}>
              <textarea
                className="w-full border border-gray-800 rounded-md p-3 text-white resize-none focus:outline-none bg-gray-900"
                placeholder="Write a reply..."
                rows={1}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
              ></textarea>

              {replyText.trim() !== "" && replyText.trim().length > 0 && (
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="px-4 py-1 text-gray-300 hover:text-white rounded-md text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition"
                  >
                    Reply
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
      
      {commentReplies && commentReplies.length > 0 && (
        <div className="ml-12 space-y-2">
          {commentReplies.map((reply: any, idx: any) => (
            <Comment key={`${reply.id}-${idx}`} comment={reply} />
          ))}
        </div>
      )}
    </>
  );
};

const CommentsSection = ({ comments, id }: { comments: any[]; id: string }) => {
  const [newComment, setNewComment] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const { mutateAsync: submitComment, isPending: isSubmitting } =
    useSubmitOpportunityComment(id);

  const handleSubmitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newComment.trim() !== "") {
      console.log("New comment:", newComment);
      await submitComment({
        content: newComment,
        parent_id: "",
      });
      setNewComment("");
      setIsFocused(false);
    }
  };

  const handleCancelComment = () => {
    setNewComment("");
    setIsFocused(false);
  };

  return (
    <div className="mt-8 border-t border-gray-800 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessagesSquare size={16} color="#9F9FA9" />
        <h2 className="text-lg font-semibold">{comments?.length} Comments</h2>
      </div>

      <form onSubmit={handleSubmitComment} className="mt-6 relative">
        <textarea
          className="w-full border border-gray-800 bg-gray-900 rounded-md p-3 text-white resize-none focus:outline-none"
          placeholder="Write Comments"
          rows={1}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onFocus={() => setIsFocused(true)}
        ></textarea>

        {newComment.trim() !== "" && newComment.length > 0 && (
          <>
            <div className="text-gray-400 text-xs flex justify-end">
              {`${280 - newComment.trim().length} characters left`}
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleCancelComment}
                className="px-4 py-2 text-gray-300 hover:text-white rounded-md text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 bg-indigo-600 text-white rounded-md text-sm transition ${
                  newComment.trim() === ""
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-indigo-700"
                }`}
                disabled={newComment.trim() === ""}
              >
                Comment
              </button>
            </div>
          </>
        )}
      </form>

      <div className="space-y-4 mt-6">
        {comments?.map((comment, index) => (
          <div key={index} className="group">
            <Comment comment={comment} />
          </div>
        ))}
      </div>
    </div>
  );
};

const JobSidebar = ({ job }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const timeLeft = useCountdown(job?.deadline);

  return (
    <div className="bg-[#111] p-4 rounded-md border border-gray-800 sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-white flex items-center gap-2">
            <Image src={Token} alt="$" />
            {job?.total_budget} USDC
          </span>
        </div>
      </div>

      {job?.prize_distribution &&
        job?.prize_distribution?.map(
          (
            prize: { amount: string | number | bigint; position: number },
            index: number
          ) => (
            <div key={index} className="flex items-center gap-2 my-2">
              <Image src={Token} alt="$" />
              {prize.amount} USDC{" "}
              <span className="text-[#9F9FA9]">
                {getOrdinalPosition(prize.position)}
              </span>
            </div>
          )
        )}

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
            <span>{timeLeft}</span>
          </span>
          <span className="text-gray-400 text-sm">Remaining</span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3 text-white">SKILL NEEDED</h2>
        {job?.skills?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {job?.skills?.map((skill: any, index: Key | null | undefined) => (
              <div key={index}>
                <Outline label={skill.name} />
              </div>
            ))}
          </div>
        ) : (
          <div>No skills available</div>
        )}
      </div>

      <button
        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-md transition"
        onClick={() => setIsModalOpen(true)}
      >
        APPLY
      </button>

      {isModalOpen && (
        <JobApplicationModal
          id={job.id}
          customQuestions={job?.custom_questions}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

const AmbasssadorDaoSingleJobPage = () => {
  const params = useParams<{ slug: string }>();

  const { data, isLoading } = useFetchOpportunityDetails(params?.slug);
  const { data: comments, isLoading: isLoadingComments } =
    useFetchOpportunityComment(params?.slug);

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
    custom_questions: data?.custom_questions || [],
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
            <JobHeader job={headerData} />

            <div className="block md:hidden my-6">
              <JobSidebar job={sidebarData} />
            </div>

            <JobDescription data={extractDescriptionData(data)} />
            <CommentsSection id={params?.slug} comments={comments} />
          </div>

          <div className="hidden md:block md:col-span-1">
            <JobSidebar job={sidebarData} />
          </div>
        </div>
      </div>
    </div>
  );
};

const JobDetailsWithSuspense = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AmbasssadorDaoSingleJobPage />
    </Suspense>
  );
};

export default JobDetailsWithSuspense;
