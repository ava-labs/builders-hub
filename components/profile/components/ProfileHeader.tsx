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
}: ProfileHeaderProps) {
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [isHoveringName, setIsHoveringName] = useState(false);

  return (
    <div className="flex flex-col rounded-lg">
      {/* Avatar and Name Section - Horizontal Layout */}
      <div className="flex items-start gap-3 mb-4">
        {/* Small Avatar */}
        <div
          className="relative cursor-pointer pt-2"
          onMouseEnter={() => setIsHoveringAvatar(true)}
          onMouseLeave={() => setIsHoveringAvatar(false)}
          onClick={onEditAvatar}
        >
          {nounAvatarEnabled && nounAvatarSeed ? (
            <DiceBearAvatar
              seed={nounAvatarSeed}
              name={name}
              size="small"
              showProgress={false}
            />
          ) : (
            <DiceBearAvatar
              seed={null}
              name={name}
              size="small"
              showProgress={false}
            />
          )}
          {isHoveringAvatar && (
            <div className="absolute pt-2 inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer transition-opacity z-30">
              <Pencil className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        {/* Name with Edit Icon */}
        <div className="flex-1 min-w-0">
          <div 
            className="flex items-center gap-2 group"
            onMouseEnter={() => setIsHoveringName(true)}
            onMouseLeave={() => setIsHoveringName(false)}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {name || "Your Name"}
            </h2>
            {onEditName && (
              <button
                onClick={onEditName}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                type="button"
              >
                <Pencil className="h-4 w-4 text-zinc-500 dark:text-zinc-400 pt-2" />
              </button>
            )}
          </div>
          {/* Email below name */}
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            {email || "your@email.com"}
          </p>
        </div>
      </div>
    </div>
  );
}
