"use client";
import { Check, Crown } from "lucide-react";
import React, { useState } from "react";
import Image from "next/image";
import Avalance3d from "@/public/images/avalance3d.svg";
import { types } from "util";

const userTypes = [
  {
    name: "Talent",
    description:
      "Create a profile to start submitting, and get notified on new work opportunities",
    perks: [
      "Contribute to top Solana projects",
      "Build your web3 resume",
      "Automated yield farming solutions",
    ],
  },
  {
    name: "Sponsor",
    description:
      "List a bounty or freelance gig for your project and find your next contributor",
    perks: [
      "Get in front of 10,000 weekly visitors",
      "20+ templates to choose from",
      "100% free",
    ],
  },
];
const AmbasssadorDaoOnboardPage = () => {
  const [userType, setUserType] = useState<"talent" | "sponsor">("talent");
  return (
    <div className="bg-black max-w-7xl mx-auto p-4 sm:p-8 md:p-16 lg:p-24">
      <div className="w-full flex flex-col md:flex-row gap-8 md:gap-6">
        {userTypes.map((type, idx) => (
          <div
            key={idx}
            className={`rounded-xl border border-[#27272A] bg-[#09090B] p-6 flex-1 cursor-pointer
                ${
                  userType === type.name.toLowerCase() ? "border-[#FB2C36]" : ""
                }
                `}
            onClick={() => setUserType(type.name.toLowerCase() as any)}
          >
            <div className="flex items-center gap-6">
              <div className="w-10 md:w-14 h-10 md:h-14 shrink-0 flex items-center justify-center bg-[#FB2C36] rounded-full p-2">
                <Crown color="white" size={28} />
              </div>
              <div className="text-[#FAFAFA]">
                <p className="font-medium text-2xl md:text-3xl">
                  Continue as <span className="capitalize">{type.name}</span>
                </p>
                <p>{type.description}</p>
              </div>
            </div>

            <hr className="my-6" />

            <div className="bg-black rounded-md h-36 md:h-44 relative overflow-hidden">
              <Image
                src={Avalance3d}
                objectFit="contain"
                alt="avalance icon"
                className="absolute right-0"
              />
            </div>
            <hr className="my-6" />

            <div className="flex flex-col space-y-2">
              {type.perks.map((perk, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-[#FAFAFA]"
                >
                  <Check color="white" size={16} />
                  <p className="text-sm">{perk}</p>
                </div>
              ))}
            </div>
            <hr className="my-6" />

            <div className="flex justify-center">
              <button
                type="submit"
                className="bg-[#FB2C36] rounded-md text-[#FAFAFA] px-6 h-10 text-sm font-medium"
              >
                Continue as <span className="capitalize">{type.name}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AmbasssadorDaoOnboardPage;
