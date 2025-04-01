"use client";

import React from "react";
import Modal from "../ui/Modal";
import Link from "next/link";

interface OnboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardModal : React.FC<OnboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete your onboarding"
      description="Complete your onboarding process first!"
    >
      <div className="p-6">
        <Link href="/ambassador-dao/onboard">
          Complete your onboarding process first!
        </Link>
      </div>
    </Modal>
  );
};

export default OnboardModal;
