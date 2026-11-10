import { ArrowRight, Check, CheckCircle, Clock, ChevronRight } from 'lucide-react';

/**
 * Lightweight step card used by the validator management flows.
 * Renders a numbered square (or checkmark when complete) with title, description, and children.
 */
export interface StepFlowCardProps {
  step: number;
  title: string;
  description?: string | React.ReactNode;
  isComplete?: boolean;
  isActive?: boolean;
  children?: React.ReactNode;
}

export const StepFlowCard: React.FC<StepFlowCardProps> = ({
  step,
  title,
  description,
  isComplete = false,
  isActive = true,
  children,
}) => {
  const cardClasses = isComplete
    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
    : isActive
      ? 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
      : 'bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-50';

  const circleClasses = isComplete
    ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
    : isActive
      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
      : 'border-zinc-200 bg-transparent text-zinc-400 dark:border-zinc-800';

  const titleClasses = isComplete || isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600';

  const descriptionClasses =
    isComplete || isActive ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600';

  return (
    <div className={`border p-3 transition-colors ${cardClasses}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[11px] font-bold tabular-nums ${circleClasses}`}
        >
          {isComplete ? <Check className="h-3 w-3" /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`text-[13px] font-medium ${titleClasses}`}>{title}</h3>
          {description && <p className={`mt-1 text-[12px] ${descriptionClasses}`}>{description}</p>}
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
        return <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'active':
        return <Clock className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />;
      case 'waiting':
        return <CheckCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'error':
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 font-mono text-[10px] font-bold text-white dark:bg-red-500">
            !
          </div>
        );
      default:
        return <div className="h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600"></div>;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'active':
        return 'text-zinc-900 dark:text-zinc-100';
      case 'waiting':
        return 'text-amber-700 dark:text-amber-400';
      case 'error':
        return 'text-red-700 dark:text-red-400';
      default:
        return 'text-zinc-500 dark:text-zinc-400';
    }
  };

  return (
    <div className="flex items-center">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className={`text-[13px] font-medium ${getStatusColor()}`}>
          <span className="mr-1.5 font-mono text-[11px] tabular-nums">{String(stepNumber).padStart(2, '0')}</span>
          {title}
        </div>
      </div>
      {!isLast && <ArrowRight className="mx-4 h-3.5 w-3.5 text-zinc-400" />}
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
        return 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60';
      case 'active':
        return 'bg-white dark:bg-zinc-950 border-zinc-900 dark:border-zinc-300';
      case 'waiting':
        return 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60';
      case 'error':
        return 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/60';
      default:
        return 'bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800';
    }
  };

  // Don't allow collapsing if step is not completed
  const canToggle = status === 'completed';

  return (
    <div className={`overflow-hidden border ${getHeaderBg()}`}>
      <div
        className={`group/step flex items-center justify-between p-4 ${canToggle ? 'cursor-pointer' : ''}`}
        onClick={canToggle ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <StepIndicator stepNumber={stepNumber} title={title} status={status} />
        </div>
        {canToggle && (
          <ChevronRight
            className={`h-3.5 w-3.5 text-zinc-400 transition-all group-hover/step:text-[#E6212F] ${isExpanded ? 'rotate-90' : ''}`}
          />
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="mb-4 text-[13px] text-zinc-500 dark:text-zinc-400">{description}</p>
          {error && (
            <div className="mb-4 border border-red-200 bg-red-50/60 p-3 dark:border-red-900/60 dark:bg-red-950/20">
              <div className="text-[13px] text-red-800 dark:text-red-300">{error}</div>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
