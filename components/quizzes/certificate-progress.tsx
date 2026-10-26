import { Award, Check } from 'lucide-react';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import Quiz from '@/components/quizzes/quiz';
import { cn } from '@/utils/cn';

// acad-cert-progress: the bar's fill spans the track with its own round ends and slides in from the left to the
// completed share, the track's rounded overflow clipping the rest, so a passed question fills it by transform, never
// by width, in 600ms on the strong ease-out. A scale would square the round end, and a clip-path edge off the pixel
// grid thins the bar's top row. Under Reduce Motion the site policy transitions no transform: the bar changes at once.
const FILL = 'block h-full w-full rounded-[2px] bg-ac-red transition-transform duration-600 ease-out';

// acad-cert-progress: a count changed by a question passed on this visit rolls its number up 4px and fades it in, in
// 220ms on the strong ease-out (acad-quiz-rise, app/global.css); under Reduce Motion it changes at once (motion-safe).
const ROLL = 'inline-block motion-safe:animate-[acad-quiz-rise_220ms_var(--ease-out)_backwards]';

// acad-cert-progress: the ring of a question passed on this visit fills in 200ms on plain ease, and its check draws over
// 300ms, 100ms later (acad-quiz-draw). The check draws under Reduce Motion too, a stroke and not a movement: the
// !important keeps it past the site policy's 1ms, and the policy fades the ring's colours in 150ms.
const RING_SETTLE = 'transition-[border-color,background-color] duration-200 ease-[ease]';
const RING_CHECK_DRAW =
  '[&>path]:[stroke-dasharray:23] [&>path]:animate-[acad-quiz-draw_300ms_var(--ease-out)_100ms_backwards]!';

/**
 * A count: its number, then the words after it. Once a question passed on this visit changes it (rolls), the number
 * rolls in, keyed so that each later change rolls it again; until then it is plain text, as the page loaded it.
 */
function Count({ completed, rest, rolls }: { completed: number; rest: string; rolls: boolean }) {
  if (!rolls) return `${completed}${rest}`;
  return (
    <span>
      <span key={completed} className={ROLL}>
        {completed}
      </span>
      {rest}
    </span>
  );
}

/** Production's two progress lines in one card, with a red bar at the completed share. */
export function CertificateProgress({
  completed,
  total,
  rolls = false,
}: {
  completed: number;
  total: number;
  /** A question passed on this visit changed the count: its number rolls in. */
  rolls?: boolean;
}) {
  const share = total > 0 ? Math.min(1, completed / total) : 0;
  return (
    <div className="not-prose mb-9 mt-1 grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 gap-y-3.5 rounded-xl border border-ac-rule bg-ac-paper px-[18px] pb-[18px] pt-4 max-md:mb-7 max-md:gap-x-2.5 max-md:px-3.5 max-md:pb-4 max-md:pt-3.5">
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-ac-tile text-ac-ink">
        <Award className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <div>
        <p className="m-0 text-[15px] font-semibold leading-[1.35] text-ac-ink max-md:text-[14.5px]">
          Complete all quizzes to get your certificate.
        </p>
        <p className="m-0 text-[13.5px] leading-[1.35] text-ac-ink-3 tabular-nums">
          <Count completed={completed} rest={` of ${total} quizzes completed.`} rolls={rolls} />
        </p>
      </div>
      <span className="col-span-2 block h-1 overflow-hidden rounded-[2px] bg-ac-rule" aria-hidden="true">
        <span className={FILL} style={{ transform: `translateX(${share * 100 - 100}%)` }} />
      </span>
    </div>
  );
}

/** A chapter heading with its "n of m" count, a check in ok once every question is answered correctly. */
export function ChapterHeading({
  chapter,
  completed,
  total,
  rolls = false,
}: {
  chapter: string;
  completed: number;
  total: number;
  /** A question of this chapter passed on this visit changed the count: its number rolls in. */
  rolls?: boolean;
}) {
  const complete = total > 0 && completed === total;
  return (
    <h3 className="mb-3 mt-0 flex items-baseline justify-between gap-3 font-ac-display text-[19px] font-medium leading-[1.4] tracking-[-0.01em] text-ac-ink max-md:mb-2.5 max-md:text-[17px]">
      {chapter}
      <span
        className={cn(
          'inline-flex items-center gap-[5px] whitespace-nowrap font-sans text-[13px] font-medium tracking-normal tabular-nums max-md:text-[12.5px]',
          complete ? 'text-ac-ok' : 'text-ac-ink-3',
        )}
      >
        {complete && <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />}
        <Count completed={completed} rest={` of ${total}`} rolls={rolls} />
      </span>
    </h3>
  );
}

/**
 * A question row's title: the status mark (a check when answered correctly, an empty ring otherwise),
 * which names its status to screen readers, then the question.
 */
export function QuestionTitle({
  question,
  answered,
  passedNow = false,
}: {
  question: string;
  answered: boolean;
  /** The question was passed on this visit: its ring's check draws itself. */
  passedNow?: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          'inline-flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] max-md:size-[18px]',
          RING_SETTLE,
          answered ? 'border-ac-ok bg-ac-ok text-ac-paper' : 'border-ac-ink-3',
        )}
      >
        {answered && (
          <Check
            className={cn('size-3 max-md:size-[11px]', passedNow && RING_CHECK_DRAW)}
            strokeWidth={3}
            aria-hidden="true"
          />
        )}
        <span className="sr-only">{answered ? 'Answered correctly' : 'Not answered yet'}</span>
      </span>
      <span>{question}</span>
    </>
  );
}

interface ChapterQuiz {
  id: string;
  question: string;
}

interface CertificateChaptersProps {
  chapters: readonly string[];
  quizzesByChapter: Record<string, readonly ChapterQuiz[]>;
  completedQuizzes: readonly string[];
  onQuizCompleted: (quizId: string) => void;
  /** The quizzes passed on this page on this visit: their rings draw their checks and their chapters' counts roll. */
  passedNow?: readonly string[];
}

/** Each chapter's heading with its count, then its questions as accordion rows, each row holding its quiz. */
export function CertificateChapters({
  chapters,
  quizzesByChapter,
  completedQuizzes,
  onQuizCompleted,
  passedNow = [],
}: CertificateChaptersProps) {
  return (
    <>
      {chapters.map((chapter) => {
        const chapterQuizzes = quizzesByChapter[chapter];

        return (
          <div key={chapter} className="mb-8">
            <ChapterHeading
              chapter={chapter}
              completed={chapterQuizzes.filter((quiz) => completedQuizzes.includes(quiz.id)).length}
              total={chapterQuizzes.length}
              rolls={chapterQuizzes.some((quiz) => passedNow.includes(quiz.id))}
            />
            <Accordions type="single" collapsible data-cert-questions="">
              {chapterQuizzes.map((quiz) => (
                <Accordion
                  key={quiz.id}
                  // fumadocs defaults an item's value to String(title), and this title is a React node: without
                  // the id every row would get the value "[object Object]", so a chapter's rows would open together.
                  value={quiz.id}
                  title={
                    <QuestionTitle
                      question={quiz.question}
                      answered={completedQuizzes.includes(quiz.id)}
                      passedNow={passedNow.includes(quiz.id)}
                    />
                  }
                >
                  <Quiz quizId={quiz.id} onQuizCompleted={onQuizCompleted} showPosition={false} />
                </Accordion>
              ))}
            </Accordions>
          </div>
        );
      })}
    </>
  );
}
