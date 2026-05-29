import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { HackathonHeader } from '@/types/hackathons';
import { Calendar, Trophy, Rocket, Check, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React from 'react';
import SubmitButton from '../SubmitButton';
import JoinButton from '../JoinButton';
import { EventReferralButton } from '../EventReferralModal';
import { normalizeEventsLang, t } from '@/lib/events/i18n';
import type { SubmissionStatus } from '@/lib/hackathons/submission-progress';
import Link from 'next/link';

export default function Submission({
  hackathon,
  isRegistered = false,
  isAuthenticated = false,
  utm = '',
  submissionStatus = 'none',
  submissionProgress = 0,
  submissionProjectId = null,
}: {
  hackathon: HackathonHeader;
  isRegistered?: boolean;
  isAuthenticated?: boolean;
  utm?: string;
  submissionStatus?: SubmissionStatus;
  submissionProgress?: number;
  submissionProjectId?: string | null;
}) {
  const lang = normalizeEventsLang(hackathon.content?.language);
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const hasStages = Array.isArray(hackathon.content.stages) && hackathon.content.stages.length > 0;

  const submissionDeadlineDate = hackathon.content?.submission_deadline
    ? new Date(hackathon.content.submission_deadline)
    : null;
  const hasValidDeadline = submissionDeadlineDate !== null && !isNaN(submissionDeadlineDate.getTime());

  // Stages own the entire submission experience (each stage renders its own
  // cards + submit form), so when a hackathon has stages the legacy single
  // Submission section disappears entirely — not just its button.
  if (hasStages) return null;

  return (
    <section className='py-16 text-black dark:text-white'>
      <h2 className='text-4xl font-bold' id='submission'>
        {t(lang, 'section.submission.title')}
      </h2>
      <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800' />
      <p className='text-lg mb-8'>
        {t(lang, 'section.submission.subtitle')}
      </p>

      {/* Hacker submission status card — only shown when logged in and registered */}
      {isAuthenticated && isRegistered && (
        <div className={
          'mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border px-5 py-4 ' +
          (submissionStatus === 'complete'
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : submissionStatus === 'draft'
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-zinc-500/30 bg-zinc-500/5')
        }>
          <div className='flex items-start gap-3'>
            {submissionStatus === 'complete' ? (
              <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-500' />
            ) : submissionStatus === 'draft' ? (
              <Clock className='mt-0.5 size-5 shrink-0 text-amber-500' />
            ) : (
              <AlertCircle className='mt-0.5 size-5 shrink-0 text-zinc-400' />
            )}
            <div>
              <p className={
                'font-semibold text-sm ' +
                (submissionStatus === 'complete'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : submissionStatus === 'draft'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-zinc-600 dark:text-zinc-300')
              }>
                {submissionStatus === 'complete'
                  ? t(lang, 'submission.status.complete')
                  : submissionStatus === 'draft'
                  ? t(lang, 'submission.status.inProgress')
                  : t(lang, 'submission.status.notStarted')}
              </p>
              {submissionStatus === 'draft' && (
                <div className='mt-2 flex items-center gap-2'>
                  <div className='h-2 w-48 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-700'>
                    <div
                      className='h-full rounded-full bg-amber-500 transition-all'
                      style={{ width: `${submissionProgress}%` }}
                    />
                  </div>
                  <span className='text-xs text-amber-700 dark:text-amber-300 font-medium'>
                    {submissionProgress}%
                  </span>
                </div>
              )}
              {submissionStatus === 'complete' && (
                <p className='mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 opacity-80'>
                  {t(lang, 'submission.status.completeSub')}
                </p>
              )}
            </div>
          </div>
          {submissionStatus === 'none' ? (
            <Link
              href={`/events/project-submission?event=${hackathon.id}`}
              className='shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300'
            >
              {t(lang, 'submission.status.notStartedCta')}
            </Link>
          ) : (
            <Link
              href={
                submissionProjectId
                  ? `/events/project-submission?event=${hackathon.id}&project=${submissionProjectId}`
                  : `/events/project-submission?event=${hackathon.id}`
              }
              className={
                'shrink-0 rounded-md px-4 py-2 text-xs font-medium ' +
                (submissionStatus === 'complete'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600')
              }
            >
              {submissionStatus === 'complete'
                ? t(lang, 'submission.status.editCta')
                : t(lang, 'submission.status.inProgressCta')}
            </Link>
          )}
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-4'>
        <div className='bg-zinc-200 dark:bg-zinc-900 p-6 shadow-md flex flex-col items-start justify-center rounded-tl-md rounded-tr-md lg:rounded-tr-none rounded-bl-md'>
          <Calendar
            className={`mb-4 !text-zinc-600 dark:!text-zinc-400`}
            size={24}
          />
          <h3 className='text-xl font-semibold mb-2'>
            {t(lang, 'section.submission.deadline')}
          </h3>
          <p className='text-sm'>
            {t(lang, 'section.submission.submissionsCloseOn')}{' '}
            {hasValidDeadline ? (
              <>
                <b>
                  {new Intl.DateTimeFormat(locale, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: hackathon.timezone,
                  }).format(submissionDeadlineDate!)}
                </b>
                , at{' '}
                <b>
                  {new Intl.DateTimeFormat(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: hackathon.timezone,
                  }).format(submissionDeadlineDate!)}{' '}
                  {hackathon.timezone}
                </b>
                .
              </>
            ) : (
              <b>TBD</b>
            )}
          </p>
        </div>

        <div className='bg-zinc-700 dark:bg-zinc-800 p-6 shadow-md flex flex-col items-start justify-center'>
          <Check
            size={24}
            className={`mb-4 !text-zinc-200 dark:!text-zinc-400`}
          />
          <h3 className='text-xl font-semibold mb-2 text-zinc-50'>
            {t(lang, 'section.submission.requirements')}
          </h3>
          <p className='text-sm text-zinc-50'>
            {t(lang, 'section.submission.requirementsText')}
          </p>
        </div>

        <div className='bg-zinc-200 dark:bg-zinc-900 p-6 shadow-md flex flex-col items-start justify-center'>
          <Trophy
            size={24}
            className={`mb-4 !text-zinc-600 dark:!text-zinc-400`}
          />
          <h3 className='text-xl font-semibold mb-2'>
            {t(lang, 'section.submission.evaluationCriteria')}
          </h3>
          <p className='text-sm'>
            {t(lang, 'section.submission.evaluationCriteriaText')}
          </p>
        </div>

        <div className='bg-zinc-700 dark:bg-zinc-800 p-6 shadow-md flex flex-col items-start justify-center lg:rounded-tr-md rounded-bl-md lg:rounded-bl-none rounded-br-md'>
          <Rocket
            size={24}
            className={`mb-4 !text-zinc-200 dark:!text-zinc-400`}
          />
          <h3 className='text-xl font-semibold mb-2 text-zinc-50'>
            {t(lang, 'section.submission.submissionProcess')}
          </h3>
          <p className='text-sm text-zinc-50'>
            {t(lang, 'section.submission.submissionProcessText')}
          </p>
        </div>
      </div>

      <div className='flex flex-wrap justify-center mt-8 gap-4'>
        <EventReferralButton
          hackathonId={hackathon.id}
          hackathonTitle={hackathon.title}
          lang={lang}
          isAuthenticated={isAuthenticated}
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button  variant='red' className='w-2/5 md:w-1/3 lg:w-1/4 cursor-pointer'>
              {t(lang, 'section.submission.viewFullGuidelines')}
            </Button>
          </DialogTrigger>
          <DialogContent className='dark:bg-zinc-900 bg-zinc-50'>
            <div className='max-w-lg text-white rounded-2xl'>
              <div className='flex items-center space-x-3'>
                <div className='p-2 bg-red-500 rounded-full'>
                  <Trophy size={24} color='#F5F5F9' />
                </div>
                <h1 className='text-3xl font-semibold'>
                  {t(lang, 'section.submission.guidelinesTitle')}
                </h1>
              </div>
              <span className='block w-full h-[1px] my-8 bg-red-500'></span>
              <div className='prose text-zinc-50'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {hackathon.content.judging_guidelines}
                </ReactMarkdown>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {!hasStages && (
          <SubmitButton
            hackathonId={hackathon.id}
            customSubmissionLink={hackathon.content.submission_custom_link}
            label={
            submissionStatus === 'complete'
              ? t(lang, "section.submission.editProject")
              : submissionStatus === 'draft'
              ? t(lang, "section.submission.continueProject")
              : t(lang, "section.submission.submitProject")
          }
          variant={submissionStatus === 'none' ? 'red' : 'default'}
            isAuthenticated={isAuthenticated}
          projectId={submissionProjectId}
          />
        )}
      </div>
    </section>
  );
}
