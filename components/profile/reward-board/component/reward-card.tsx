"use client";
import React, { useState } from "react";
import Image from "next/image";
import { BadgeCardProps } from "../types/badgeCard";
import { Card, CardContent } from "@/components/ui/card";
import "./reward-card.css";

export const RewardCard = ({
  name,
  description,
  className,
  image,
  is_unlocked,
  requirements,
}: BadgeCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className={`reward-card w-full max-w-sm mx-auto ${
        isFlipped ? "flipped" : ""
      }`}
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      <div
        className={`reward-card-container rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105  ${
          className ?? ""
        }`}
      >
        {/* front */}
        <div className="reward-card-front">
          <Card className="h-full border-0 shadow-none bg-transparent">
            <CardContent className="p-0 h-full flex flex-col">
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
                      imageRendering: "crisp-edges",
                      filter: is_unlocked ? "none" : "grayscale(100%)",
                    }}
                    
                  />
                </div>
              </div>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 text-center">
                <div className="text-base sm:text-lg font-bold dark:text-white text-gray-900 mb-1 sm:mb-2 line-clamp-2">
                  {name}
                </div>
                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300 line-clamp-3">
                  {description}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* back */}
        <div className="reward-card-back">
          <Card className="h-full border-0 shadow-none bg-transparent">
            <CardContent className="p-0 h-full flex items-center justify-center">
              <div className="text-center">
                <ul>
                  {requirements?.map((requirement) => (
                    <li key={requirement.id}>{requirement.description}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
