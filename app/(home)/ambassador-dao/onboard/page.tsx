"use client";
import { Check, Crown, X, Upload, ChevronDown } from "lucide-react";
import React, { useState } from "react";
import Image from "next/image";
import Avalance3d from "@/public/images/avalance3d.svg";
import { Input } from "@/components/ui/input";
import CustomInput from "@/components/ambassador-dao/input";
import CustomSelect from "@/components/ambassador-dao/select";

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
  const [selectionStep, setShowSelectionStep] = useState<
    "account_option" | "account_form"
  >("account_option");

  const handleContinue = (type: "talent" | "sponsor") => {
    setUserType(type);
    setShowSelectionStep("account_form");
  };

  const handleClose = () => {
    setShowSelectionStep("account_option");
  };

  return (
    <div className="bg-black max-w-7xl mx-auto p-4 sm:p-8 md:p-16 lg:p-24">
      {selectionStep === "account_option" && (
        <div className="w-full flex flex-col md:flex-row gap-8 md:gap-6">
          {userTypes.map((type, idx) => (
            <div
              key={idx}
              className={`rounded-xl border border-[#27272A] bg-[#09090B] p-6 flex-1 cursor-pointer
                  ${
                    userType === type.name.toLowerCase()
                      ? "border-[#FB2C36]"
                      : ""
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

              <hr className="my-6 border-[#27272A]" />

              <div className="bg-black rounded-md h-36 md:h-44 relative overflow-hidden">
                <Image
                  src={Avalance3d}
                  objectFit="contain"
                  alt="avalance icon"
                  className="absolute right-0"
                />
              </div>

              <hr className="my-6 border-[#27272A]" />

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

              <hr className="my-6 border-[#27272A]" />

              <div className="flex justify-center">
                <button
                  type="button"
                  className="bg-[#FB2C36] rounded-md text-[#FAFAFA] px-6 h-10 text-sm font-medium"
                  onClick={() => handleContinue(type.name.toLowerCase() as any)}
                >
                  Continue as <span className="capitalize">{type.name}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectionStep === "account_form" && (
        <div className="bg-[#09090B] rounded-xl border border-[#27272A] p-6 py-10">
          {userType === "talent" && <TalentForm handleClose={handleClose} />}
          {userType === "sponsor" && <SponsorForm handleClose={handleClose} />}
        </div>
      )}
    </div>
  );
};

export default AmbasssadorDaoOnboardPage;

const TalentForm = ({ handleClose }: { handleClose: () => void }) => {
  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-[#FAFAFA] text-xl md:text-2xl font-medium">
          Finish Your Profile
        </h2>
        <button
          onClick={handleClose}
          className="text-[#FAFAFA] hover:bg-[#27272A] p-1 rounded-md"
        >
          <X size={20} color="#9F9FA9" />
        </button>
      </div>
      <p className="text-[#9F9FA9] text-sm">
        It takes less than a minute to start earning in global standards.
      </p>

      <hr className="border-[#27272A] my-6" />

      <form className="text-[#FAFAFA] text-sm mt-6 md:mt-10 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CustomInput
            id="firstName"
            label="First Name"
            placeholder="First Name"
            required
          />
          <CustomInput
            id="lastName"
            label="Last Name"
            placeholder="Last Name"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CustomInput
            id="userName"
            label="User Name"
            placeholder="User Name"
            required
          />
          <CustomSelect id="location" label="Location" required>
            <option value="1">Location 1</option>
            <option value="2">Location 2</option>
            <option value="3">Location 3</option>
          </CustomSelect>
        </div>
        <div>
          <CustomInput
            id="skills"
            label="Your Skills"
            placeholder="Badge"
            required
          />
          <div className="flex flex-wrap gap-2">
            {["Badge", "Badge", "Badge", "Badge"].map((badge, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-[#09090B] border border-[#27272A] rounded-full px-3 py-1 text-sm"
              >
                {badge}
                <span className="text-[#A1A1AA]">+</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <CustomInput
            id="socials"
            label="Socials"
            placeholder="Socials"
            required
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="flex items-center text-sm text-[#A1A1AA]"
            >
              <span>+</span> Add Link
            </button>
          </div>
        </div>

        <hr className="border-[#27272A] my-6" />
        <div className="flex">
          <button
            type="submit"
            className="bg-[#FB2C36] rounded-md text-[#FAFAFA] px-6 h-10 text-sm font-medium"
          >
            Create Profile
          </button>
        </div>
      </form>
    </div>
  );
};

const SponsorForm = ({ handleClose }: { handleClose: () => void }) => {
  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-[#FAFAFA] text-xl md:text-2xl font-medium">
          Welcome to Ambassador DAO
        </h2>
        <button
          onClick={handleClose}
          className="text-[#FAFAFA] hover:bg-[#27272A] p-1 rounded-md"
        >
          <X size={20} color="#9F9FA9" />
        </button>
      </div>
      <p className="text-[#9F9FA9] text-sm mb-8">
        It takes less than a minute to start earning in global standards.
      </p>
      <hr />
      <h3 className="text-[#FAFAFA] font-medium text-xl my-6">About you</h3>
      <hr />

      <form className="text-[#FAFAFA] text-sm mt-6 md:mt-10 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CustomInput
            id="firstName"
            label="First Name"
            placeholder="First Name"
            required
          />
          <CustomInput
            id="lastName"
            label="Last Name"
            placeholder="Last Name"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CustomInput
            id="userName"
            label="User Name"
            placeholder="User Name"
            required
          />
          <CustomSelect id="location" label="Location" required>
            <option value="1">Location 1</option>
            <option value="2">Location 2</option>
            <option value="3">Location 3</option>
          </CustomSelect>
        </div>
        <div className="mb-6">
          <label className="block text-sm">
            Upload Profile Image or Avatar
            <span className="text-[#FB2C36]">*</span>
          </label>
          <p className="text-xs text-[#A1A1AA] mb-2">
            Add the image here. Recommended size: 512 x 512px (square format)
          </p>
          <div className="border border-dashed border-[#27272A] rounded-md p-6 flex flex-col items-center justify-center h-32">
            <Upload size={24} className="text-[#A1A1AA] mb-2" color="white" />
            <p className="text-sm text-[#A1A1AA]">
              Drag your file(s) or{" "}
              <button type="button" className="text-[#FAFAFA] underline">
                browse
              </button>
            </p>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Max 1 MB files are allowed
            </p>
          </div>
        </div>

        <hr />

        <h3 className="text-[#FAFAFA] font-medium text-xl my-6">
          About Your Company
        </h3>

        <hr />

        <div className="mt-6 md:mt-10 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomInput
              id="companyName"
              label="Company Name"
              placeholder="Company Name"
              required
            />
            <CustomInput
              id="companyUserName"
              label="Company User Name"
              placeholder="Company User Name"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomInput
              id="companyUrl"
              label="Company Url"
              placeholder="Company Url"
              required
            />
            <CustomInput
              id="companyTwitter"
              label="Company Twitter"
              placeholder="Company Twitter"
            />
          </div>
          <div className="">
            <label className="block text-sm">
              Company Logo<span className="text-[#FB2C36]">*</span>
            </label>
            <p className="text-xs text-[#A1A1AA] mb-2">
              Add the image here. Recommended size: 512 x 512px (square format)
            </p>
            <div className="border border-dashed border-[#27272A] rounded-md p-6 flex flex-col items-center justify-center h-32">
              <Upload size={24} className="text-[#A1A1AA] mb-2" color="white" />
              <p className="text-sm text-[#A1A1AA]">
                Drag your file(s) or{" "}
                <button type="button" className="text-[#FAFAFA] underline">
                  browse
                </button>
              </p>
              <p className="text-xs text-[#A1A1AA] mt-1">
                Max 1 MB files are allowed
              </p>
            </div>
          </div>
          <CustomInput
            id="industry"
            label="Industry"
            placeholder="Industry"
            required
          />
          <CustomInput
            id="companyBio"
            label="Company Short Bio"
            placeholder="Company Short Bio"
            required
          />
        </div>
        <hr className="border-[#27272A] my-6" />
        <div className="flex">
          <button
            type="submit"
            className="bg-[#FB2C36] rounded-md text-[#FAFAFA] px-6 h-10 text-sm font-medium"
          >
            Create Sponsor
          </button>
        </div>
      </form>
    </div>
  );
};
