import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { Mail } from "lucide-react";
import React, { useState } from "react";
import { VerificationInput } from "../verification-code";
import { DialogTitle } from "@radix-ui/react-dialog";

interface ISignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SignupStep = "options" | "email" | "verification" | "error";

export const SignupModal = ({ isOpen, onClose }: ISignupModalProps) => {
  const [currentStep, setCurrentStep] = useState<SignupStep>("options");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const onCloseModal = () => {
    onClose();
    setCurrentStep("options");
  };

  const handleVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(verificationCode);
    onCloseModal();
  };

  const renderStep = () => {
    switch (currentStep) {
      case "options":
        return <OptionsStep setCurrentStep={setCurrentStep} />;
      case "email":
        return (
          <EmailStep
            setCurrentStep={setCurrentStep}
            setEmail={setEmail}
            email={email}
          />
        );
      case "verification":
        return (
          <VerificationStep
            email={email}
            setVerificationCode={setVerificationCode}
            handleVerificationSubmit={handleVerificationSubmit}
          />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCloseModal}>
      <DialogContent
        className="max-w-3xl h-full bg-gray-50 dark:bg-[#09090B]"
        showClose
      >
        <DialogTitle></DialogTitle>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
};

interface OptionsStepProps {
  setCurrentStep: React.Dispatch<React.SetStateAction<SignupStep>>;
}

const OptionsStep = ({ setCurrentStep }: OptionsStepProps) => (
  <div className="flex flex-col items-center justify-center h-full p-4 md:p-6 max-w-md mx-auto">
    <div className="mb-8 md:mb-12 text-center">
      <h1 className="text-[#FAFAFA] text-2xl font-medium">Sign up</h1>
      <p className="text-[#9F9FA9] text-sm">
        Sign up with email or choose another method
      </p>
    </div>

    <div className="flex flex-col gap-8 w-full">
      <button
        className="bg-[#FAFAFA] rounded-md text-[#09090B] w-full h-10 text-sm font-medium flex items-center justify-center gap-2"
        onClick={() => setCurrentStep("email")}
      >
        <Mail size={16} color="#09090B" />
        <p>Login with email</p>
      </button>

      <div className="w-full gap-4 flex items-center">
        <hr className="w-full " />
        <p className="whitespace-nowrap uppercase text-[#9F9FA9] text-xs">
          Or sign up with
        </p>
        <hr className="w-full" />
      </div>

      <button className="bg-transparent rounded-md border border-[#27272A] text-[#FAFAFA] w-full h-10 text-sm font-medium flex items-center justify-center gap-2">
        <SiGoogle size={16} color="#FAFAFA" />
        <p>Google</p>
      </button>
    </div>

    <p className="text-sm font-normal text-[#A1A1AA] mt-8 md:mt-16 text-center">
      By clicking continue, you agree to our 
      <span className="underline">Terms of Service</span> and 
      <span className="underline">Privacy Policy.</span>
    </p>
  </div>
);

interface EmailStepProps {
  setCurrentStep: React.Dispatch<React.SetStateAction<SignupStep>>;
  setEmail: (email: string) => void;
  email: string;
}

const EmailStep = ({ setCurrentStep, setEmail, email }: EmailStepProps) => (
  <div className="flex flex-col items-center justify-center h-full p-4 md:p-6 max-w-md mx-auto">
    <div className="mb-8 text-center">
      <h1 className="text-[#FAFAFA] text-2xl font-medium">Sign up</h1>
      <p className="text-[#9F9FA9] text-sm">
        Sign up with email or choose another method
      </p>
    </div>

    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCurrentStep("verification");
        }}
      >
        <input
          type="email"
          placeholder="name@example.com"
          className="bg-transparent border border-[#27272A] rounded-md w-full h-10 px-3 text-[#FAFAFA] mb-4 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-[#FB2C36] rounded-md text-[#FAFAFA] w-full h-10 text-sm font-medium uppercase"
        >
          SEND VERIFICATION CODE
        </button>
      </form>
    </div>

    <p className="text-sm font-normal text-[#A1A1AA] mt-8 md:mt-16 text-center">
      By clicking continue, you agree to our{" "}
      <span className="underline">Terms of Service</span> and{" "}
      <span className="underline">Privacy Policy.</span>
    </p>
  </div>
);

interface VerificationStepProps {
  email: string;
  setVerificationCode: (code: string) => void;
  handleVerificationSubmit: (e: React.FormEvent) => void;
}

const VerificationStep = ({
  email,
  setVerificationCode,
  handleVerificationSubmit,
}: VerificationStepProps) => (
  <div className="flex flex-col items-center justify-center h-full p-4 md:p-6 max-w-md mx-auto">
    <div className="mb-8 text-center">
      <h1 className="text-[#FAFAFA] text-2xl font-medium">Verify Your Email</h1>
      <p className="text-[#9F9FA9] text-sm">
        Please enter the 6-digit code sent to {email}
      </p>
    </div>

    <form onSubmit={handleVerificationSubmit} className="w-full">
      <VerificationInput onChange={(code) => setVerificationCode(code)} />
      <button
        type="submit"
        className="bg-[#FAFAFA] rounded-md text-[#09090B] w-full h-10 text-sm font-medium mt-6 md:mt-8"
      >
        Verify Email
      </button>
    </form>

    <p className="text-sm font-normal text-[#FAFAFA] mt-6 md:mt-10 text-center">
      Didn't receive a code?{" "}
      <span className="text-[#9F9FA9] cursor-pointer">Resend code</span>
    </p>

    <p className="text-sm font-normal text-[#FAFAFA] mt-8 md:mt-12 text-center">
      You can request a new code in 00:30 seconds.
    </p>
  </div>
);
