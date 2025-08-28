import React from "react";
import Image from "next/image";
import { BadgeCardProps } from "../types/badgeCard";
import { getLucideIcon } from "./get-lucide-icon";

export const RewardCard = ({
  icon,
  name,
  description,
  className,
  category,
  image,
}: BadgeCardProps) => {
  return (
    <div
      className={
        "rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-300 w-full max-w-sm mx-auto overflow-hidden  hover:scale-105 " +
        (className ?? "")
      }
    >
      <div className="relative px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex flex-col items-center min-h-[100px] sm:min-h-[120px]">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20">
          <Image
            src={image}
            alt={name + " icon"}
            width={128}
            height={128}
            className="object-contain w-full h-full"
            draggable={false}
            quality={90}
            priority={false}
            unoptimized={false}
            style={{
              imageRendering: 'crisp-edges',
            }}
          />
        </div>

        {/* Top right category icon */}
        {/* TODO: we have to decide if we want to show the category icon or not */}
        {/* <div className="absolute top-3 sm:top-4 right-3 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-md ">
          <span className="text-blue-700 w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center">
            {getLucideIcon(category.trim(), {
              size: 16,
              strokeWidth: 2.5,
              absoluteStrokeWidth: true,
            })}
          </span>
        </div> */}
      </div>
      <div className="px-4 sm:px-6 pb-4 sm:pb-6 text-center">
        <div className="text-base sm:text-lg font-bold dark:text-white text-gray-900 mb-1 sm:mb-2 line-clamp-2">
          {name}
        </div>
        <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300 line-clamp-3">
          {description}
        </div>
      </div>
    </div>
  );
};
