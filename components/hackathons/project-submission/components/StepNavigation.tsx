import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useFormContext } from "react-hook-form";
import { SubmissionForm } from "../hooks/useSubmissionForm";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";

interface StepNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: (formValues: any) => void;
  onSave: () => void;
  isLastStep: boolean;
}

export const StepNavigation = ({
  currentStep,
  onStepChange,
  onSubmit,
  onSave,
  isLastStep,
}: StepNavigationProps) => {
  const form = useFormContext<SubmissionForm>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingLater, setIsSavingLater] = useState(false);
  const step1Fields: (keyof SubmissionForm)[] = [
    "project_name",
    "short_description",
    "full_description",
    "tracks",
  ];

  const step2Fields: (keyof SubmissionForm)[] = [
    "tech_stack",
    "github_repository",
    "explanation",
    "demo_link",
    "is_preexisting_idea",
  ];

  const handleNext = async () => {
    if (currentStep < 3) {
      let valid = false;
      if (currentStep === 1) {
        valid = await form.trigger(step1Fields);
      } else if (currentStep === 2) {
        valid = await form.trigger(step2Fields);
      }

      if (valid) {
        const formValues = form.getValues();
        onSubmit(formValues);
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between mt-8">
      <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
        <LoadingButton
          isLoading={isSubmitting}
          loadingText="Saving..."
          type={isLastStep ? "submit" : "button"} 
          variant="red"
          className="px-4 py-2 cursor-pointer"
          onClick={() => {
            setIsSubmitting(true);
            try {
              handleNext();
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isLastStep ? "Final Submit" : "Continue"}
        </LoadingButton>

        <LoadingButton
          isLoading={isSavingLater}
          loadingText="Saving..."
          type="button"
          onClick={() => {
            try {
              setIsSavingLater(true);
              onSave();
            } finally {
              setIsSavingLater(false);
            }
          }}
          className="bg-white text-black border border-gray-300 hover:text-black hover:bg-gray-100 cursor-pointer"
        >
          Save & Continue Later
        </LoadingButton>
      </div>

      <div className="flex flex-col md:flex-row items-center">
        <div className="flex items-center space-x-1">
          {currentStep > 1 && (
            <PaginationPrevious
              className="dark:hover:text-gray-200 cursor-pointer"
              onClick={() => onStepChange(currentStep - 1)}
            />
          )}
          <Pagination>
            <PaginationContent>
              {Array.from({ length: 3 }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={currentStep === page}
                    className="cursor-pointer"
                    onClick={() => onStepChange(page)}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
            </PaginationContent>
          </Pagination>
          {currentStep < 3 && (
            <PaginationNext
              className="dark:hover:text-gray-200 cursor-pointer"
              onClick={handleNext}
            />
          )}
        </div>
        <div className="mt-2 md:mt-0 md:ml-4">
          <span className="font-Aeonik text-xs sm:text-sm">
            Step {currentStep} of 3
          </span>
        </div>
      </div>
    </div>
  );
};
