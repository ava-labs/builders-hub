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
      description='Complete User Profile'
      maxWidth='max-w-lg'
    >
      <div className='px-6 pb-6'>
        <p className='text-sm text-[var(--white-text-color)] mb-4'>
          To continue your job application, please fill in your user details to
          start applying for jobs immediately.
        </p>
        <Link href='/ambassador-dao/onboard'>
          <CustomButton variant='danger'>Complete onboarding!</CustomButton>
        </Link>
      </div>
    </Modal>
  );
};

export default OnboardModal;
