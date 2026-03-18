import { Separator } from "@/components/ui/separator";
import { BadgesByTeam } from "@/types/badgesByTeam";
import Image from "next/image";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";

type Props = {
  Badge: BadgesByTeam[];
};
export const TeamBadge = ({ Badge }: Props) => {
  const DataDummy = [
    {
      Badge: {
        name: "Best UI/UX",
        description: "For the best UI/UX design",
        points: 100,
        image_path:
          "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/badges/badgeWinner.png",
        category: "UI/UX",
        metadata: null,
      },
      quantity: 1,
      owner: "John Doe",
    },
    {
      Badge: {
        name: "BUG HUNTER",
        description: "For the best UI/UX design",
        points: 100,
        image_path:
          "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/badges/badge_Exterminador_bugs.png",
        category: "UI/UX",
        metadata: null,
      },
      quantity: 2,
      owner: "Joan Mosquera,Sebastian Ortiz",
    },
    {
      Badge: {
        name: "BORN TO BE A HACKER",
        description: "For the best UI/UX design",
        points: 100,
        image_path:
          "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/badges/badge_born_to_code.png",
        category: "UI/UX",
        metadata: null,
      },
      quantity: 3,
      owner: "Joan Mosquera,Sebastian Ortiz,John Doe",
    },
    {
      Badge: {
        name: "Best Team",
        description: "For the best UI/UX design",
        points: 100,
        image_path:
          "https://49ci7gswyprqetfg.public.blob.vercel-storage.com/badges/BestTeamEN.png",
        category: "UI/UX",
        metadata: null,
      },
      quantity: 3,
      owner: "Joan Mosquera,Sebastian Ortiz,John Doe",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold">Team Reward Board</h2>
      <Separator className="my-8 bg-zinc-300 dark:bg-zinc-800" />

      <div className="flex flex-wrap justify-center gap-8 mt-8">
        {DataDummy.map((item, index) => (
          <div
            key={index}
            className="flex flex-col justify-center items-center gap-4"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Image
                    src={item.Badge.image_path}
                    alt={item.Badge.name}
                    width={150}
                    height={150}
                    className="w-40 h-40 rounded-full"
                  />
                </TooltipTrigger>
                <TooltipContent className="text-center">
                  <div className="max-w-xs">
                    <h1 className="font-bold mb-2 text-center">{item.Badge.name}</h1>
                    <p className="text-sm mb-2 text-center">awarded to: </p>
                    <div className="text-sm text-center">
                      <ul className="list-disc list-inside space-y-1">
                        {item.owner.split(",").map((owner, ownerIndex) => (
                          <li key={ownerIndex} className="text-left">
                            {owner.trim()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
 
      </div>
    </div>
  );
};
