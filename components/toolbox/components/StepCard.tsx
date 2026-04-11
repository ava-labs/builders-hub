import { ArrowRight, Check, CheckCircle, Clock, ChevronRight } from 'lucide-react';

/**
 * Lightweight step card used by the validator management flows.
 * Renders a numbered circle (or checkmark when complete) with title, description, and children.
 */
export interface StepFlowCardProps {
  step: number;
  title: string;
  description?: string | React.ReactNode;
  isComplete: boolean;
  isActive?: boolean;
  children?: React.ReactNode;
}

export const StepFlowCard: React.FC<StepFlowCardProps> = ({
  step,
  title,
  description,
  isComplete,
  isActive = true,
  children,
}) => {
  const cardClasses = isComplete
    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
    : isActive
      ? 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
      : 'bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200/50 dark:border-zinc-800 opacity-50';

  const circleClasses = isComplete
    ? 'bg-green-500 text-white'
    : isActive
      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
      : 'bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400';

  const titleClasses = isComplete || isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600';

  const descriptionClasses =
    isComplete || isActive ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600';

  return (
    <div className={`p-3 rounded-xl border transition-colors ${cardClasses}`}>
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${circleClasses}`}
        >
          {isComplete ? <Check className="w-3 h-3" /> : step}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${titleClasses}`}>{title}</h3>
          {description && <p className={`mt-1 text-xs ${descriptionClasses}`}>{description}</p>}
          {children}
        </div>
      </div>
    </div>
  );
};

export const StepIndicator = ({
  stepNumber,
  title,
  status,
  isLast = false,
}: {
  stepNumber: number;
  title: string;
  status: 'pending' | 'active' | 'waiting' | 'completed' | 'error';
  isLast?: boolean;
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'active':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'waiting':
        return <CheckCircle className="h-5 w-5 text-orange-500" />;
      case 'error':
        return (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">!</div>
        );
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600"></div>;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'active':
        return 'text-blue-600 dark:text-blue-400';
      case 'waiting':
        return 'text-orange-600 dark:text-orange-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-zinc-500 dark:text-zinc-400';
    }
  };

  return (
    <div className="flex items-center">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className={`font-medium text-sm ${getStatusColor()}`}>
          {stepNumber}. {title}
        </div>
      </div>
      {!isLast && <ArrowRight className="h-4 w-4 text-zinc-400 mx-4" />}
    </div>
  );
};

export const StepCard = ({
  stepNumber,
  title,
  description,
  status,
  isExpanded,
  onToggle,
  children,
  error,
}: {
  stepNumber: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'waiting' | 'completed' | 'error';
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  error?: string;
}) => {
  const getHeaderBg = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200/80 dark:border-green-800';
      case 'active':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200/80 dark:border-blue-800';
      case 'waiting':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200/80 dark:border-orange-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200/80 dark:border-red-800';
      default:
        return 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-800';
    }
  };

  // Don't allow collapsing if step is not completed
  const canToggle = status === 'completed';

  return (
    <div className={`border rounded-xl overflow-hidden ${getHeaderBg()}`}>
      <div
        className={`p-4 flex items-center justify-between ${canToggle ? 'cursor-pointer' : ''}`}
        onClick={canToggle ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <StepIndicator stepNumber={stepNumber} title={title} status={status} />
        </div>
        {canToggle && (
          <ChevronRight className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{description}</p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800 rounded-xl">
              <div className="text-red-700 dark:text-red-300 text-sm">{error}</div>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
