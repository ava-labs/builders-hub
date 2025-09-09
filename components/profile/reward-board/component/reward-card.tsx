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
      className={`reward-card w-full max-w-sm mx-auto  ${
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
              <div className="relative px-2 sm:px-4  sm:pt-2 flex flex-col items-center min-h-[100px] sm:min-h-[120px]">
                <div className="relative w-18 h-18 sm:w-20 sm:h-20">
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
                <div 
                  className="text-base font-bold dark:text-white text-gray-900 mb-1 sm:mb-2 line-clamp-2"
                  title={name}
                >
                  {name}
                </div>
                <div 
                  className="text-base text-gray-600 dark:text-white line-clamp-3"
                  title={description}
                >
                  {description}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* back */}
        <div className="reward-card-back">
          <Card className="h-full border-0 shadow-none bg-transparent">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="px-6 pt-6 pb-2">
                <h3 className="text-base text-center font-semibold dark:text-white text-gray-900 mb-4">
                  Requirements
                </h3>
              </div>
              <div className="flex-1 px-6 pb-6 overflow-y-auto max-h-48">
                <ul className="text-left ">
                  {requirements?.map((requirement) => (

                    <li 
                      key={requirement.id} 
                      className="flex items-start space-x-3 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span className="flex-shrink-0 w-2 h-2 bg-gradient-to-r from-red-500 to-zinc-700 rounded-full mt-2"></span>
             
                      <span 
                        className="leading-relaxed " 
                        style={{textDecoration: requirement.unlocked ?  "line-through" : "none"}}
                        title={requirement.description}
                      >
                        {requirement.description}: <span className="font-bold">{requirement.points} points</span>
                      </span>
                    </li>
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
