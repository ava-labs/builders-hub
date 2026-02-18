"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { DiceBearAvatar, AvatarSeed } from "./DiceBearAvatar";

interface ProfileHeaderProps {
  name?: string;
  username?: string;
  email?: string;
  country?: string;
  image?: string;
  onEditAvatar: () => void;
  onEditName?: () => void;
  nounAvatarSeed?: AvatarSeed | null;
  nounAvatarEnabled?: boolean;
  /** 0–100; drives the circular progress bar around the avatar. */
  completionPercentage?: number;
}

export function ProfileHeader({
  name,
  username,
  email,
  country,
  image,
  onEditAvatar,
  onEditName,
  nounAvatarSeed,
  nounAvatarEnabled = false,
  completionPercentage = 0,
}: ProfileHeaderProps) {
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [isHoveringName, setIsHoveringName] = useState(false);

  return (
    <div className="flex flex-col rounded-lg">
      {/* Avatar and Name Section - Horizontal Layout */}
      <div className="flex items-start gap-3 mb-4">
        {/* Small Avatar: container h-14 w-14 (avatar circle is h-12 w-12) */}
        <div
          className="relative h-14 w-14 shrink-0 cursor-pointer pt-2"
          onMouseEnter={() => setIsHoveringAvatar(true)}
          onMouseLeave={() => setIsHoveringAvatar(false)}
          onClick={onEditAvatar}
        >
          {nounAvatarEnabled && nounAvatarSeed ? (
            <DiceBearAvatar
              seed={nounAvatarSeed}
              name={name}
              size="small"
              showProgress={true}
              profileProgress={completionPercentage}
            />
          ) : (
            <DiceBearAvatar
              seed={null}
              name={name}
              size="small"
              showProgress={true}
              profileProgress={completionPercentage}
            />
          )}
          {isHoveringAvatar && (
            <div
              className="absolute inset-0 flex items-center justify-center pt-2 z-30 cursor-pointer transition-opacity"
              onClick={onEditAvatar}
              role="button"
              aria-label="Edit avatar"
            >
              <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center">
                <Pencil className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Name with Edit Icon */}
        <div className="flex-1 min-w-0">
          <div 
            className="flex items-start gap-2 group"
            onMouseEnter={() => setIsHoveringName(true)}
            onMouseLeave={() => setIsHoveringName(false)}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 wrap-break-word flex-1">
              {name || "Your Name"}
            </h2>
            {onEditName && (
              <button
                onClick={onEditName}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                type="button"
              >
                <Pencil className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>
            )}
          </div>
          {/* Email below name - split before @ for better wrapping */}
          {email && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 wrap-break-word">
              {email.includes('@') ? (
                <>
                  <span className="break-all">{email.split('@')[0]}</span>
                  <span className="wrap-break-word">@{email.split('@')[1]}</span>
                </>
              ) : (
                email
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
