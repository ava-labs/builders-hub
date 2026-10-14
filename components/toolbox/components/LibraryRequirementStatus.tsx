import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface LibraryRequirementStatusProps {
  libraryAddress: string | null;
  libraryName?: string;
}

const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]';

export function LibraryRequirementStatus({
  libraryAddress,
  libraryName = 'ValidatorMessages',
}: LibraryRequirementStatusProps) {
  if (!libraryAddress) {
    return (
      <div className="flex items-start gap-3 border border-red-200 bg-red-50/60 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 space-y-1">
          <p className={`${EYEBROW} text-red-700 dark:text-red-400`}>Required</p>
          <p className="text-[13px] leading-relaxed text-red-800 dark:text-red-300">
            {libraryName} library must be deployed first. Please go to the{' '}
            <span className="font-medium">Validator Manager Setup</span> section and deploy the {libraryName} library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 space-y-1">
        <p className={`${EYEBROW} text-emerald-700 dark:text-emerald-400`}>Ready</p>
        <p className="text-[13px] leading-relaxed text-emerald-900 dark:text-emerald-200">
          {libraryName} library found at: <code className="break-all font-mono text-[12px]">{libraryAddress}</code>
        </p>
      </div>
    </div>
  );
}
