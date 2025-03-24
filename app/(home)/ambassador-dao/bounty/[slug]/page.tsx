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
import {
  useDeleteOpportunityComment,
  useEditOpportunityComment,
  useFetchOpportunityComment,
  useFetchOpportunityDetails,
  useReplyOpportunityComment,
  useSubmitOpportunityComment,
  useFetchOpportunityCommentReplies,
} from "@/services/ambassador-dao/requests/opportunity";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { getTimeLeft } from "@/utils/timeFormatting";
import { useCountdown } from "@/components/ambassador-dao/hooks/useCountdown";
import Image from "next/image";
import Token from "@/public/ambassador-dao-images/token.png";
import { getOrdinalPosition } from "@/utils/getOrdinalPosition";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import Loader from "@/components/ambassador-dao/ui/Loader";
import { Pagination } from "@/components/ambassador-dao/ui/Pagination";
import { BountySubmissionModal } from "@/components/ambassador-dao/bounty/BountySubmissionModal";

interface CommentAuthor {
  id: string;
  first_name: string;
  last_name: string;
}

interface CommentReply {
  id: string;
  content: string;
  parent_id: string;
  author: CommentAuthor;
  isOptimistic?: boolean;
}

interface Comment {
  id: string;
  content: string;
  author: CommentAuthor;
  parent_id?: string;
  isOptimistic?: boolean;
  _count?: {
    replies: number;
  };
}

interface BountyHeaderProps {
  bounty: {
    id: string;
    title: string;
    companyName: string;
    companyLogo?: string;
    createdBy: string;
    type?: string;
    deadline: string;
    proposalsCount: number;
    skills: Array<{ name: string } | string>;
  };
}

interface BountyDescriptionProps {
  data: {
    title: string;
    content: string[];
  };
}

interface CommentProps {
  comment: Comment;
  opportunityId: string;
}

interface BountySidebarProps {
  bounty: {
    id: string;
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

const BountySidebar: React.FC<BountySidebarProps> = ({ bounty }) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const timeLeft = useCountdown(bounty?.deadline);

  return (
    <div className="bg-[#111] p-4 rounded-md border border-gray-800 sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-white flex items-center gap-2">
            <Image src={Token} alt="$" />
            {bounty?.total_budget} USDC
          </span>
        </div>
      </div>

      {bounty?.prize_distribution &&
        bounty?.prize_distribution?.map(
          (prize: { amount: number; position: number }, index: number) => (
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
        {bounty?.skills?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {bounty?.skills?.map((skill: { name: string }, index: number) => (
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

const BountyHeader: React.FC<BountyHeaderProps> = ({ bounty }) => {
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
          <h1 className="text-base font-bold text-red-500 mb-2">{bounty.title}</h1>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-sm">{bounty.companyName}</span>
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
              bounty.skills.map((skill: { name: string } | string, index: Key) => (
                <div key={index}>
                  <Outline
                    label={typeof skill === "string" ? skill : skill.name}
                  />
                </div>
              ))
            ) : (
              <span className="text-gray-400 text-sm">No skills specified</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const  BountyDescription: React.FC<BountyDescriptionProps> = ({ data }) => {
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

interface ReplyProps {
  reply: CommentReply;
  isOptimistic: boolean;
}

const Reply: React.FC<ReplyProps> = ({ reply, isOptimistic = false }) => {
  return (
    <div
      className={`p-4 border border-gray-800 rounded-lg my-2 relative bg-gray-900 bg-opacity-50 ${
        isOptimistic ? "border-blue-400 border-opacity-50" : ""
      }`}
    >
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 flex items-center justify-center">
          <span className="text-white text-xs">
            {reply?.author?.first_name?.substring(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <div className="mb-1">
            <h3 className="font-medium text-[#FB2C36]">
              {reply?.author?.first_name} {reply?.author?.last_name}
            </h3>
          </div>
          <p className="text-gray-300 text-sm">{reply?.content}</p>
        </div>
      </div>
    </div>
  );
};

interface CommentRepliesProps {
  commentId: string;
  opportunityId: string;
  repliesCount: number;
}

const CommentReplies: React.FC<CommentRepliesProps> = ({
  commentId,
  opportunityId,
  repliesCount,
}) => {
  const [replies, setReplies] = useState<CommentReply[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [optimisticReplies, setOptimisticReplies] = useState<CommentReply[]>(
    []
  );
  const [showReplies, setShowReplies] = useState<boolean>(false);
  const [repliesLoaded, setRepliesLoaded] = useState<boolean>(false);
  const { data: userData } = useFetchUserDataQuery();

  const { refetch } = useFetchOpportunityCommentReplies(commentId);

  const loadReplies = async () => {
    setIsLoading(true);
    try {
      const { data: fetchedReplies } = await refetch();

      if (fetchedReplies && Array.isArray(fetchedReplies)) {
        const filteredReplies = fetchedReplies.filter(
          (reply) => reply.parent_id === commentId
        );
        setReplies(filteredReplies);
        const confirmedReplyIds = new Set(
          filteredReplies.map((r) => r.content)
        );
        setOptimisticReplies((prev) =>
          prev.filter((r) => !confirmedReplyIds.has(r.content))
        );
      }
      setRepliesLoaded(true);
      setShowReplies(true);
    } catch (error) {
      setIsError(true);
      console.error("Failed to load replies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const [isReplying, setIsReplying] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>("");

  const { mutateAsync: replyComment } =
    useReplyOpportunityComment(opportunityId);

  const handleReplySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (replyText.trim() !== "") {
      const optimisticReply: CommentReply = {
        id: `optimistic-${Date.now()}`,
        content: replyText,
        parent_id: commentId,
        author: {
          id: userData?.id || "",
          first_name: userData?.first_name || "You",
          last_name: userData?.last_name || "",
        },
        isOptimistic: true,
      };

      setOptimisticReplies((prev) => [...prev, optimisticReply]);

      setReplyText("");
      setIsReplying(false);

      if (!showReplies && repliesCount > 0) {
        setShowReplies(true);
      }

      replyComment({
        content: replyText,
        parent_id: commentId,
      })
        .then(async () => {
          if (repliesLoaded) {
            loadReplies();
          }
        })
        .catch((error) => {
          console.error("Failed to post reply:", error);
          setOptimisticReplies((prev) =>
            prev.filter((r) => r.id !== optimisticReply.id)
          );
        });
    }
  };

  const handleCancelReply = () => {
    setReplyText("");
    setIsReplying(false);
  };

  const toggleReplies = () => {
    if (!repliesLoaded && repliesCount > 0) {
      loadReplies();
    } else {
      setShowReplies(!showReplies);
    }
  };

  const displayReplies = [...replies, ...optimisticReplies];

  const displayRepliesCount = repliesLoaded
    ? replies.length + optimisticReplies.length
    : repliesCount;

  if (displayRepliesCount === 0 && !isReplying && !isLoading) {
    return (
      <div className="ml-12 my-2">
        <button
          type="button"
          onClick={() => setIsReplying(!isReplying)}
          className="hover:text-white text-gray-400 px-4 rounded-md text-sm transition"
        >
          Reply
        </button>

        {isReplying && (
          <div className="mt-2">
            <form onSubmit={handleReplySubmit}>
              <textarea
                className="w-full border border-gray-800 rounded-md p-3 text-white resize-none focus:outline-none bg-gray-900"
                placeholder="Write a reply..."
                rows={1}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
              ></textarea>

              {replyText.trim() !== "" && (
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
    );
  }

  return (
    <div className="ml-12">
      <div className="flex items-center gap-2 my-2">
        {displayRepliesCount > 0 && (
          <button
            type="button"
            onClick={toggleReplies}
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition"
          >
            {isLoading ? (
              <span>Loading replies...</span>
            ) : (
              <>
                {displayRepliesCount}{" "}
                {displayRepliesCount === 1 ? "Reply" : "Replies"}
                <span className="text-xs">{showReplies ? "▲" : "▼"}</span>
              </>
            )}
          </button>
        )}

        <span className="text-gray-500">•</span>

        <button
          type="button"
          onClick={() => setIsReplying(!isReplying)}
          className="hover:text-white text-gray-400 text-sm transition"
        >
          Reply
        </button>
      </div>

      {isReplying && (
        <div className="mt-2">
          <form onSubmit={handleReplySubmit}>
            <textarea
              className="w-full border border-gray-800 rounded-md p-3 text-white resize-none focus:outline-none bg-gray-900"
              placeholder="Write a reply..."
              rows={1}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              autoFocus
            ></textarea>

            {replyText.trim() !== "" && (
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

      {isError && !optimisticReplies.length && (
        <div className="text-red-500 text-sm my-2">Failed to load replies</div>
      )}

      {showReplies && displayReplies.length > 0 && (
        <div className="space-y-2 mt-2 pl-2 border-l-2 border-gray-800">
          {displayReplies.map((reply, idx) => (
            <Reply
              key={`reply-${reply.id}-${idx}`}
              reply={reply}
              isOptimistic={!!reply.isOptimistic}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Comment: React.FC<CommentProps> = ({ comment, opportunityId }) => {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>(comment.content);
  const optionsRef = useRef<HTMLDivElement>(null);

  const { mutateAsync: editComment } = useEditOpportunityComment(comment.id);
  const { mutateAsync: deleteComment } = useDeleteOpportunityComment(
    comment.id
  );
  const { data: userData } = useFetchUserDataQuery();

  const isEditable = userData?.id === comment?.author?.id;
  const repliesCount = comment._count?.replies || 0;

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const originalContent = comment.content;

    comment.content = editText;
    setIsEditing(false);

    editComment({
      content: editText,
    }).catch((error) => {
      console.error("Failed to edit comment:", error);
      comment.content = originalContent;
      setEditText(originalContent);
    });
  };

  const handleDeleteComment = () => {
    deleteComment();
    setShowOptions(false);
  };

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
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
    <div
      className={`group ${
        comment.isOptimistic ? "border-blue-400 border-opacity-50" : ""
      }`}
    >
      <div className="p-4 border border-gray-800 rounded-lg my-2 relative">
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
                  className="absolute right-4 top-4 bg-gray-800 rounded-md shadow-lg z-10 py-1 min-w-[100px]"
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
      </div>

      {!isEditing && !comment.isOptimistic && (
        <CommentReplies
          commentId={comment.id}
          opportunityId={opportunityId}
          repliesCount={repliesCount}
        />
      )}
    </div>
  );
};

interface CommentsSectionProps {
  id: string;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ id }) => {
  const [newComment, setNewComment] = useState<string>("");
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [optimisticComments, setOptimisticComments] = useState<Comment[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [comments, setComments] = useState<Comment[]>([]);
  const [metadata, setMetadata] = useState({
    total: 0,
    last_page: 1,
    current_page: 1,
    per_page: 10,
    prev_page: null,
    next_page: null,
  });

  const { data: userData } = useFetchUserDataQuery();

  const {
    data: commentsData,
    isLoading: isLoadingComments,
    refetch,
  } = useFetchOpportunityComment(id, {
    page: currentPage,
    per_page: 10,
  });

  useEffect(() => {
    if (commentsData) {
      if (commentsData.data && Array.isArray(commentsData.data)) {
        setComments(commentsData.data);

        const confirmedCommentIds = new Set(
          commentsData.data.map((c: any) => c.content)
        );
        setOptimisticComments((prev) =>
          prev.filter((c) => !confirmedCommentIds.has(c.content))
        );
      }

      if (commentsData.metadata) {
        setMetadata(commentsData.metadata);
      }
    }
  }, [commentsData]);

  const displayComments = [...comments, ...optimisticComments];


  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setOptimisticComments([]);
  };

  const { mutateAsync: submitComment, isPending: isSubmitting } =
    useSubmitOpportunityComment(id);

  const handleSubmitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newComment.trim() !== "") {
      const optimisticComment: Comment = {
        id: `optimistic-${Date.now()}`,
        content: newComment,
        author: {
          id: userData?.id || "",
          first_name: userData?.first_name || "You",
          last_name: userData?.last_name || "",
        },
        isOptimistic: true,
        _count: {
          replies: 0,
        },
      };

      setOptimisticComments((prev) => [...prev, optimisticComment]);

      setNewComment("");
      setIsFocused(false);

      try {
        await submitComment({
          content: newComment,
          parent_id: "",
        });

        if (currentPage !== 1) {
          setCurrentPage(1);
        } else {
          refetch();
        }
      } catch (error) {
        console.error("Failed to submit comment:", error);

        setOptimisticComments((prev) =>
          prev.filter((c) => c.id !== optimisticComment.id)
        );
      }
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
        <h2 className="text-lg font-semibold">
          {metadata.total || 0} Comments
        </h2>
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
                className={`px-4 py-2 bg-red-500 text-white rounded-md text-sm transition ${
                  newComment.trim() === ""
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-red-600"
                }`}
                disabled={newComment.trim() === "" || isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Comment"}
              </button>
            </div>
          </>
        )}
      </form>

      {isLoadingComments ? (
        <div className="flex justify-center my-8">
          <Loader />
        </div>
      ) : (
        <>
          <div className="space-y-4 mt-6">
            {displayComments.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              displayComments.map((comment, index) => (
                <Comment
                  key={`comment-${comment.id}-${index}`}
                  comment={comment}
                  opportunityId={id}
                />
              ))
            )}
          </div>

          {metadata.last_page > 1 && (
            <Pagination
              metadata={metadata}
              onPageChange={handlePageChange}
              className="my-8"
            />
          )}
        </>
      )}
    </div>
  );
};

const AmbasssadorDaoSingleBountyPage = () => {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;

  const { data, isLoading } = useFetchOpportunityDetails(slug);

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
    const descriptionParagraphs = apiResponse?.description
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
    total_budget: data?.total_budget || 0,
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
            <BountyHeader bounty={headerData} />

            <div className="block md:hidden my-6">
              <BountySidebar bounty={sidebarData} />
            </div>

            <BountyDescription data={extractDescriptionData(data)} />

            <CommentsSection id={slug} />
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
