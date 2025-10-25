import { ReactNode, Children, cloneElement, isValidElement } from "react";

interface ProgressStepsProps {
  currentStep: number;
  completedSteps: number[];
  children: ReactNode;
}

interface ProgressStepProps {
  stepNumber: number;
  children: ReactNode;
  // Internal props injected by ProgressSteps
  _status?: 'completed' | 'active' | 'pending';
}

export function ProgressSteps({ currentStep, completedSteps, children }: ProgressStepsProps) {
  return (
    <div className="fd-steps progress-steps">
      {Children.map(children, (child, index) => {
        if (!isValidElement<ProgressStepProps>(child)) return child;

        const stepNumber = child.props.stepNumber || index + 1;
        const isCompleted = completedSteps.includes(stepNumber);
        const isCurrent = currentStep === stepNumber;

        let status: 'completed' | 'active' | 'pending' = 'pending';
        if (isCompleted) status = 'completed';
        else if (isCurrent) status = 'active';

        return cloneElement(child, {
          _status: status,
        });
      })}
    </div>
  );
}

export function ProgressStep({ children, _status = 'pending' }: ProgressStepProps) {
  return (
    <div className="fd-step" data-status={_status}>
      {children}
    </div>
  );
}
