import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useFormContext } from "react-hook-form";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { SubmissionForm } from "../hooks/useSubmissionFormSecure";

interface StepNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onSave: () => Promise<void>;
  isLastStep: boolean;
  onNextStep: () => void;
}

export const StepNavigation = ({
  currentStep,
  onStepChange,
  onSave,
  isLastStep,
  onNextStep,
}: StepNavigationProps) => {
  const form = useFormContext<SubmissionForm>();
  const [isSavingLater, setIsSavingLater] = useState(false);



  const validateStep1 = (): boolean => {
    const values = form.getValues();
    let hasErrors = false;

    if (!values.project_name || values.project_name.trim() === '') {
      form.setError('project_name', { type: 'manual', message: 'Project name is required' });
      hasErrors = true;
    }

    if (!values.short_description || values.short_description.trim() === '') {
      form.setError('short_description', { type: 'manual', message: 'Short description is required' });
      hasErrors = true;
    }

    if (!values.tracks || values.tracks.length === 0) {
      form.setError('tracks', { type: 'manual', message: 'Please select at least one track' });
      hasErrors = true;
    }

    return !hasErrors;
  };

  const handleNext = async () => {
    if (currentStep >= 3) return;

    if (currentStep === 1 && !validateStep1()) {
      return;
    }

    onNextStep();
  };

  const handleStepChange = (targetStep: number) => {
    if (currentStep === 1 && targetStep > 1 && !validateStep1()) {
      return;
    }
    onStepChange(targetStep);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between mt-8">
      <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
        <LoadingButton
          isLoading={form.formState.isSubmitting}
          loadingText="Saving..."
          type={isLastStep ? 'submit' : 'button'}
          variant="red"
          className="px-4 py-2 cursor-pointer"
          onClick={(e) => {
            if (!isLastStep) {
              e.preventDefault();
              handleNext();
            }
          }}
        >
          {isLastStep ? 'Final Submit' : 'Continue'}
        </LoadingButton>

        <LoadingButton
          isLoading={isSavingLater}
          loadingText="Saving..."
          type="button"
          onClick={async () => {
            try {
              setIsSavingLater(true);
              await onSave();
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
                    onClick={() => handleStepChange(page)}
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
