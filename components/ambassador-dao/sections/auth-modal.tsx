import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ambassador-dao/dialog";
import { Mail } from "lucide-react";
import React, { useState, useEffect, Suspense } from "react";
import { VerificationInput } from "../verification-code";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import {
  useHandleGoogleCallback,
  useRequestPasscodeMutation,
  useVerifyPasscodeMutation,
} from "@/services/ambassador-dao/requests/auth";
import { useRouter } from "next/navigation";
import CustomButton from "../custom-button";
import CustomInput from "../input";
import { API_DEV } from "@/services/ambassador-dao/data/constants";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { useNavigationWithLoading } from "@/utils/useNavigationWithLoading";
import LoadingOverlay from "../loading-overlay";

interface IAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  stopRedirection?: boolean;
}

type AuthStep = "options" | "email" | "verification";

const SearchParamsHandler = ({
  setCurrentStep,
  setEmail,
}: {
  setCurrentStep: React.Dispatch<React.SetStateAction<AuthStep>>;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const searchParams = useSearchParams();
  const { mutate: googleCallbackMutation } = useHandleGoogleCallback();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      googleCallbackMutation(code);
    }
  }, [searchParams, googleCallbackMutation]);

  return null;
};

export const AuthModal = ({
  isOpen,
  onClose,
  stopRedirection,
}: IAuthModalProps) => {
  const [currentStep, setCurrentStep] = useState<AuthStep>("options");
  const [email, setEmail] = useState("");

  const onCloseModal = () => {
    onClose();
    setCurrentStep("options");
  };

  const renderStep = () => {
    switch (currentStep) {
      case "options":
        return <OptionsStep setCurrentStep={setCurrentStep} />;
      case "email":
        return (
          <EmailStep setCurrentStep={setCurrentStep} setEmail={setEmail} />
        );
      case "verification":
        return (
          <VerificationStep
            email={email}
            onClose={onCloseModal}
            stopRedirection={stopRedirection}
          />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCloseModal}>
      <DialogContent
        className='max-w-2xl bg-[#fafafa] dark:bg-[#09090B]'
        showClose
      >
        <DialogTitle></DialogTitle>
        <Suspense fallback={<FullScreenLoader />}>
          <SearchParamsHandler
            setCurrentStep={setCurrentStep}
            setEmail={setEmail}
          />
        </Suspense>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
};

interface OptionsStepProps {
  setCurrentStep: React.Dispatch<React.SetStateAction<AuthStep>>;
}

const OptionsStep = ({ setCurrentStep }: OptionsStepProps) => {
  const googleAuthUrl = `${API_DEV}/auth/google`;
  const handleGoogleLogin = async () => {
    window.open(googleAuthUrl, "_blank");
  };

  return (
    <div className='flex flex-col items-center justify-center h-full p-4 md:p-6 max-w-md mx-auto'>
      <div className='mb-8 md:mb-12 text-center'>
        <h1 className='text-[var(--primary-text-color)] text-2xl font-medium'>
          Log in
        </h1>
        <p className='text-[var(--secondary-text-color)] text-sm'>
          Log in with email or choose another method
        </p>
      </div>

      <div className='flex flex-col gap-8 w-full'>
        <CustomButton onClick={() => setCurrentStep("email")}>
          <Mail size={16} color='#09090B' />
          <p>Login with email</p>
        </CustomButton>

        <div className='w-full gap-4 flex items-center'>
          <hr className='w-full ' />
          <p className='whitespace-nowrap uppercase text-[var(--secondary-text-color)] text-xs'>
            Or sign in with
          </p>
          <hr className='w-full' />
        </div>

        <CustomButton onClick={handleGoogleLogin} variant='outlined'>
          <p>Google</p>
        </CustomButton>
      </div>

      <p className='text-sm font-normal text-[#6b6b74] dark:text-[#A1A1AA] mt-8 md:mt-16 text-center'>
        By clicking continue, you agree to our{" "}
        <span className='underline'>Terms of Service</span> and{" "}
        <span className='underline'>Privacy Policy.</span>
      </p>
    </div>
  );
};

interface EmailStepProps {
  setCurrentStep: React.Dispatch<React.SetStateAction<AuthStep>>;
  setEmail: (email: string) => void;
}

const EmailStep = ({ setCurrentStep, setEmail }: EmailStepProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>();
  const { mutateAsync: requestPasscodeMutation, isPending } =
    useRequestPasscodeMutation();

  const onSubmit = async (data: { email: string }) => {
    try {
      await requestPasscodeMutation(data.email);
      setEmail(data.email);
      setCurrentStep("verification");
    } catch (error) {
      // Error handling is done in the mutation itself
    }
  };

  return (
    <div className='flex flex-col items-center justify-center h-full p-4 md:p-6 max-w-md mx-auto'>
      <div className='mb-8 text-center'>
        <h1 className='text-[var(--primary-text-color)] text-2xl font-medium'>
          Log in
        </h1>
        <p className='text-[var(--secondary-text-color)] text-sm'>
          Log in with email or choose another method
        </p>
      </div>

      <div className='w-full'>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='mb-4'>
            <CustomInput
              type='email'
              placeholder='name@example.com'
              id='email'
              className={`bg-transparent border ${
                errors.email
                  ? "border-red-500"
                  : "border-[var(--default-border-color)]"
              } rounded-md w-full h-10 px-3 text-[var(--primary-text-color)] text-sm focus:outline-none`}
              required
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              })}
            />

            {errors.email && (
              <p className='text-red-500 text-xs mt-1'>
                {errors.email.message}
              </p>
            )}
          </div>
          <CustomButton
            type='submit'
            variant='danger'
            disabled={isPending}
            isLoading={isPending}
          >
            SEND VERIFICATION CODE
          </CustomButton>
        </form>
      </div>

      <p className='text-sm font-normal text-[#6b6b74] dark:text-[#A1A1AA] mt-8 md:mt-16 text-center'>
        By clicking continue, you agree to our{" "}
        <span className='underline'>Terms of Service</span> and{" "}
        <span className='underline'>Privacy Policy.</span>
      </p>
    </div>
  );
};

interface VerificationStepProps {
  email: string;
  onClose: () => void;
  stopRedirection?: boolean;
}

const VerificationStep = ({
  email,
  onClose,
  stopRedirection,
}: VerificationStepProps) => {
  const router = useRouter();
  const { navigateWithLoading, isNavigating } = useNavigationWithLoading();
  const [code, setCode] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ code: string }>();
  const { mutateAsync: verifyPasscodeMutation, isPending } =
    useVerifyPasscodeMutation(stopRedirection, onClose, navigateWithLoading);
  const requestPasscodeMutation = useRequestPasscodeMutation();
  const [resendDisabled, setResendDisabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!resendDisabled) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendDisabled]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleResend = async () => {
    try {
      await requestPasscodeMutation.mutateAsync(email);
      setResendDisabled(true);
      setTimeLeft(30);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const onSubmit = async () => {
    if (code.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      await verifyPasscodeMutation({
        email,
        passcode: code,
      });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <div className='flex flex-col items-center justify-center h-full p-4 md:p-6 max-w-md mx-auto'>
      {isNavigating && <LoadingOverlay message='Redirecting to dashboard...' />}
      <div className='mb-8 text-center'>
        <h1 className='text-[var(--primary-text-color)] text-2xl font-medium'>
          Verify Your Email
        </h1>
        <p className='text-[var(--secondary-text-color)] text-sm'>
          Please enter the 6-digit code sent to {email}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className='w-full'>
        <VerificationInput
          onChange={(code) => setCode(code.toLocaleUpperCase())}
        />

        <CustomButton
          type='submit'
          disabled={isPending || isNavigating}
          className='mt-6 md:mt-8'
          isLoading={isPending || isNavigating}
        >
          {"Verify Email"}
        </CustomButton>
      </form>

      <p className='text-sm font-normal text-[var(--primary-text-color)] mt-6 md:mt-10 text-center'>
        Didn't receive a code?{" "}
        <span
          className={`${
            resendDisabled
              ? "text-[var(--secondary-text-color)]"
              : "text-[#FB2C36] cursor-pointer"
          }`}
          onClick={resendDisabled ? undefined : handleResend}
        >
          Resend code
        </span>
      </p>

      <p className='text-sm font-normal text-[var(--primary-text-color)] mt-8 md:mt-12 text-center'>
        {resendDisabled
          ? `You can request a new code in ${formatTime(timeLeft)} seconds.`
          : "You can request a new code now."}
      </p>
    </div>
  );
};
