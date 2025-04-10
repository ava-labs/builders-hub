import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
interface StepNavigationProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: () => void;
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
  return (
    <div className="flex flex-col md:flex-row items-center justify-between mt-8">
      <div className="flex flex-wrap gap-4 mb-4 md:mb-0">
        <Button type="submit" variant="red" className="px-4 py-2 cursor-pointer" onClick={onSubmit}>
          {isLastStep ? "Final Submit" : "Continue"}
        </Button>

        <Button
          type="button"
          onClick={onSave}
         
          className="bg-white text-black border border-gray-300 hover:text-black hover:bg-gray-100 cursor-pointer" 
        >
          Save & Continue Later
        </Button>
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
              onClick={onSubmit}
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