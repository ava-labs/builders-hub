"use client";

import { useState } from "react";
import ReferralModal from "./ReferralModal";

export default function ReferralLink() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsModalOpen(true)} className="text-[#66acd6] underline hover:text-[#7bbde3] transition-colors font-medium">
        HERE
      </button>
      <ReferralModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
