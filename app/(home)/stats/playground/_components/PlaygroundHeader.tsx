"use client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Pencil,
  Copy,
  Check,
  Share2,
  Eye,
  Heart,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import type { PlaygroundCreator } from "./types";

interface PlaygroundHeaderProps {
  // Editable name + edit handler.
  playgroundName: string;
  onPlaygroundNameChange: (name: string) => void;
  isOwner: boolean;

  // Optional fields — only present once a playground has been saved.
  currentPlaygroundId: string | null;
  isPublic: boolean;
  savedLink: string | null;
  linkCopied: boolean;
  onCopyLink: () => void;
  onShareOnX: () => void;

  viewCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  isFavoriting: boolean;
  onToggleFavorite: () => void;

  creator: PlaygroundCreator | null;
  createdAt: string | null;
  updatedAt: string | null;

  showSubtitle: boolean;
  error: string | null;
}

export function PlaygroundHeader({
  playgroundName,
  onPlaygroundNameChange,
  isOwner,
  currentPlaygroundId,
  isPublic,
  savedLink,
  linkCopied,
  onCopyLink,
  onShareOnX,
  viewCount,
  favoriteCount,
  isFavorited,
  isFavoriting,
  onToggleFavorite,
  creator,
  createdAt,
  updatedAt,
  showSubtitle,
  error,
}: PlaygroundHeaderProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  const goToMyDashboards = () => {
    if (status === "unauthenticated" || !session) {
      openLoginModal("/stats/playground/my-dashboards");
    } else {
      router.push("/stats/playground/my-dashboards");
    }
  };

  return (
    <div className="mb-10">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 group">
            <h1
              contentEditable={isOwner}
              suppressContentEditableWarning
              onBlur={(e) => {
                if (!isOwner) return;
                const newName = e.currentTarget.textContent || "My Playground";
                onPlaygroundNameChange(newName);
              }}
              onKeyDown={(e) => {
                if (!isOwner) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.currentTarget.textContent = playgroundName;
                  e.currentTarget.blur();
                }
              }}
              className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded px-2 -mx-2 min-w-[200px]"
              style={{ cursor: isOwner ? "pointer" : "default" }}
            >
              {playgroundName || "My Playground"}
            </h1>
            {isOwner && (
              <Pencil className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            )}
          </div>

          {creator && creator.profile_privacy === "public" && (
            <div className="flex items-center gap-2 mt-2">
              {creator.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creator.image}
                  alt={creator.user_name || creator.name || "User"}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {creator.user_name || creator.name || "Unknown User"}
              </span>
            </div>
          )}

          {currentPlaygroundId && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {savedLink && (
                <>
                  <button
                    onClick={onCopyLink}
                    className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                      isPublic
                        ? "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 opacity-60"
                    }`}
                    title={
                      isPublic
                        ? linkCopied
                          ? "Link copied!"
                          : "Copy shareable link"
                        : "Make public to copy link"
                    }
                  >
                    {linkCopied && isPublic ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={onShareOnX}
                    className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                      isPublic
                        ? "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 opacity-60"
                    }`}
                    title={
                      isPublic ? "Share on X (Twitter)" : "Make public to share"
                    }
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </button>
                </>
              )}

              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <Eye className="h-3.5 w-3.5" />
                <span>{viewCount.toLocaleString()} views</span>
              </div>

              {isOwner ? (
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <Heart
                    className={`h-3.5 w-3.5 ${isFavorited ? "fill-current text-red-500" : ""}`}
                  />
                  <span>{favoriteCount} likes</span>
                </div>
              ) : (
                <button
                  onClick={onToggleFavorite}
                  disabled={isFavoriting}
                  className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                    isFavorited
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  }`}
                  title={isFavorited ? "Unlike" : "Like"}
                >
                  {isFavoriting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <Heart
                        className={`h-3.5 w-3.5 ${isFavorited ? "fill-current" : ""}`}
                      />
                      <span>{favoriteCount} likes</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 flex-wrap">
            {(createdAt || updatedAt) && (
              <>
                {createdAt && (
                  <span className="whitespace-nowrap">
                    Created{" "}
                    {new Date(createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
                {createdAt && updatedAt && (
                  <span className="text-gray-400 dark:text-gray-600 hidden sm:inline">
                    •
                  </span>
                )}
                {updatedAt && (
                  <span className="whitespace-nowrap">
                    {createdAt && (
                      <span className="text-gray-400 dark:text-gray-600 sm:hidden mr-1.5">
                        •
                      </span>
                    )}
                    Updated{" "}
                    {new Date(updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {isOwner && (
            <Button
              onClick={goToMyDashboards}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
              title="My Dashboards"
            >
              <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">My Dashboards</span>
            </Button>
          )}
        </div>
      </div>

      {showSubtitle && (
        <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
          Create and customize multiple charts with real-time chain metrics. Add
          metrics, configure visualizations, and share your insights.
        </p>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
