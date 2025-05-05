'use client';

import React, { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { AuthModal } from './sections/auth-modal';

interface Step {
  number: number;
  title: string;
  linkText?: string;
  linkHref?: string;
}

interface HowItWorksProps {
  steps: Step[];
}

const HowItWorks: React.FC<HowItWorksProps> = ({ steps }) => {

const [openAuthModal, setOpenAuthModal] = useState(false);


  return (
    <div className="dark:bg-black bg-white text-[var(--white-text-color)] py-8">
      <div className="mx-auto">
        <div className="flex items-center mb-14 gap-2">
          <ListChecks color="var(--white-text-color)" />
          <h2 className="text-lg font-medium ml-1">How It Works</h2>
        </div>

        <div className="relative">
          <svg
            className="absolute top-0 h-full z-5 pl-8"
            width="70"
            preserveAspectRatio="none"
            style={{ height: "calc(100% - 20px)" }}
          >
            <path
              d="M4,0 C24,50 50,100 30,124 C1,200 30,250 40,300 C50,350 30,400 40,450"
              fill="none"
              stroke="var(--white-text-color)"
              strokeWidth="2"
              strokeDasharray="8,8"
              strokeLinecap="round"
            />
          </svg>

          <div className="space-y-8 relative mb-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex items-center gap-4 relative dark:bg-white bg-card-grad rounded-md shadow-md pl-10"
              >
                <div className="w-9 h-9 dark:bg-white bg-black rounded-full flex items-center justify-center text-white dark:text-black text-xl font-semibold z-10">
                  {step.number}
                </div>

                <div
                  className={`${
                    step.number === 1 ? "cursor-pointer" : ""
                  } rounded-lg py-6 px-2 min-h-[80px] flex items-center text-wrap`}
                  onClick={() => step.number === 1 && setOpenAuthModal(true)}
                >
                  <h3 className="text-base font-medium dark:text-white text-black">
                    {step.title}
                    {step.linkText && (
                      <span className="ml-2 underline">{step.linkText}</span>
                    )}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={openAuthModal}
        onClose={() => setOpenAuthModal(false)}
        stopRedirection={true}
      />
    </div>
  );
};

export default HowItWorks;