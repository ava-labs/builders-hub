"use client";

import { useState, useEffect } from "react";
import ReferralModal from "./ReferralModal";
import { captureReferrerFromUrl } from "@/lib/referral";

export default function ReferralButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Capture referrer from URL on mount
  useEffect(() => {
    captureReferrerFromUrl();
  }, []);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="content-stretch flex flex-col items-center relative shrink-0"
      >
        <div className="bg-[rgba(40,106,142,0.1)] content-stretch flex h-[52px] items-center justify-center px-[36px] py-[12px] relative rounded-[3.35544e+07px] shrink-0 cursor-pointer hover:bg-[rgba(40,106,142,0.2)] transition-colors">
          <div aria-hidden="true" className="absolute border-2 border-[rgba(102,172,214,0.7)] border-solid inset-0 pointer-events-none rounded-[3.35544e+07px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
          <div className="flex flex-col font-['Aeonik:Medium',sans-serif] font-medium justify-center leading-[0] relative shrink-0 text-[#66acd6] text-[18px] text-center text-nowrap">
            <p className="leading-[28px]">Refer</p>
          </div>
        </div>
      </button>
      <ReferralModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
