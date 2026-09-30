import { academyCourse, type LearningPath } from '@/lib/academy/academy-programme';
import { cn } from '@/utils/cn';

const ROW = 'grid grid-cols-[18px_minmax(0,1fr)] gap-x-2 text-[13.5px] leading-[1.35]';
const STEP = 'font-ac-mono text-[11px] leading-[18px] text-ac-ink-3 tabular-nums';

/**
 * A course's learning path, as its hover card lists it: the optional first step, then numbered steps with the
 * course last; a join's branches sit under one number, each as a chain.
 */
export function PathSteps({ path }: { path: LearningPath }) {
  const last = path.steps.length - 1;
  return (
    <div>
      <p className="font-ac-mono text-[10.5px] uppercase tracking-[0.12em] text-ac-ink-3">Learning path</p>
      <ol className="mt-2.5 grid gap-1.5">
        {path.optional ? (
          <li className={cn(ROW, 'text-ac-ink-3')}>
            <span aria-hidden="true" />
            <span>{`${academyCourse(path.optional).name} · optional`}</span>
          </li>
        ) : null}
        {path.steps.map((step, index) => (
          <li key={step.kind === 'course' ? step.id : `branches-${index}`} className={ROW}>
            <span className={STEP}>{index + 1}</span>
            {step.kind === 'course' ? (
              <span className={index === last ? 'font-semibold text-ac-ink' : 'text-ac-ink-2'}>{academyCourse(step.id).name}</span>
            ) : (
              <span className="grid gap-1 border-l border-ac-rule-2 pl-2.5 text-ac-ink-2">
                {step.branches.map((branch) => (
                  <span key={branch.join('>')}>{branch.map((id) => academyCourse(id).name).join(', then ')}</span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
