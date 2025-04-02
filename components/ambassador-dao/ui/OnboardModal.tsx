"use client";

import React from "react";
import Modal from "../ui/Modal";
import Link from "next/link";
import CustomButton from "../custom-button";

interface OnboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardModal: React.FC<OnboardModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Action required!'
      description='Complete your onboarding'
      maxWidth='max-w-lg'
    >
      <div className='px-6 pb-6'>
        <p className='text-sm text-white mb-4'>
          TODO: Generate a better copy here. You need to complete your
          onboarding process to have access to the full actions of the platform.
        </p>
        <Link href='/ambassador-dao/onboard'>
          <CustomButton variant='danger'>
            Complete your onboarding process first!
          </CustomButton>
        </Link>
      </div>
    </Modal>
  );
};

export default OnboardModal;
