import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { HackathonHeader } from '@/types/hackathons';
import { Calendar, Trophy, Rocket, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React from 'react';
import SubmitButton from '../SubmitButton';
import JoinButton from '../JoinButton';
import { EventReferralButton } from '../EventReferralModal';
import { normalizeEventsLang, t } from '@/lib/events/i18n';

export default async function Submission({
  hackathon,
  isRegistered = false,
  isAuthenticated = false,
  utm = '',
}: {
  hackathon: HackathonHeader;
  isRegistered?: boolean;
  isAuthenticated?: boolean;
  utm?: string;
}) {
  const lang = normalizeEventsLang(hackathon.content?.language);
  const locale = lang === 'es' ? 'es-ES' : 'en-US';

  return (
    <section className='py-16 text-black dark:text-white'>
      <h2 className='text-4xl font-bold' id='submission'>
        {t(lang, 'section.submission.title')}
      </h2>
      <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800' />
      <p className='text-lg mb-8'>
        {t(lang, 'section.submission.subtitle')}
      </p>

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
            <b>
              {new Intl.DateTimeFormat(locale, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: hackathon.timezone,
              }).format(new Date(hackathon.content.submission_deadline))}
            </b>
            , at{' '}
            <b>
              {new Intl.DateTimeFormat(locale, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: hackathon.timezone,
              }).format(new Date(hackathon.content.submission_deadline))}{' '}
              {hackathon.timezone}
            </b>
            .
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
        <SubmitButton
          hackathonId={hackathon.id}
          customSubmissionLink={hackathon.content.submission_custom_link}
          label={t(lang, "section.submission.submitProject")}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </section>
  );
}
