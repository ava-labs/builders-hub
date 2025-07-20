import React from "react";
import { BadgeCardProps } from "../types/badgeCard";
import { getLucideIcon } from "./get-lucide-icon";

export const RewardCard = ({
  icon,
  name,
  description,
  className,
  category,
}: BadgeCardProps) => {
  return (
    <div
    className={
      "rounded-2xl shadow-md bg-gradient-to-b from-blue-500 to-white w-72 max-w-full overflow-hidden " +
      (className ?? "")
    }
  >
    <div className="bg-gradient-to-b from-blue-500 to-blue-400 relative px-6 pt-6 pb-3 flex flex-col items-center min-h-[120px]">
      {/* Icon principal */}
      {/* <div className="z-10 flex items-center justify-center w-12 h-12 mb-2">
        {typeof icon === "string" ? (
          <img
            src={icon}
            alt={name + " icon"}
            className="w-12 h-12 object-contain"
            draggable={false}
          />
        ) : (
          icon
        )}
      </div> */}
      {/* Top right category icon */}
      <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center shadow">
      <span className="text-blue-700 w-6 h-6 flex items-center justify-center">
            {getLucideIcon(category.trim(), { size: 24, strokeWidth: 2.5, absoluteStrokeWidth: true })}
          </span>
      </div>
    </div>
    <div className="bg-white p-6 text-center rounded-b-2xl">
      <div className="text-lg font-bold text-gray-900 mb-1">{name}</div>
      <div className="text-gray-600 text-base">{description}</div>
    </div>
  </div>
  );
};
