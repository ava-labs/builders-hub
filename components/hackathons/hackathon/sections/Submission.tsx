import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { HackathonHeader } from '@/types/hackathons';
import { Calendar, Trophy, Rocket, Check } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import React from 'react';

export default async function Submission({
  hackathon,
}: {
  hackathon: HackathonHeader;
}) {
  return (
    <section className='py-16 text-black dark:text-white'>
      <h2 className='text-4xl font-bold' id='submission'>
        Submit Your Project
      </h2>
      <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800' />
      <p className='text-lg mb-8'>
        Follow the guidelines to submit your hackathon project successfully
      </p>

      <div className='grid grid-cols-1 lg:grid-cols-4'>
        <div className='bg-zinc-200 dark:bg-zinc-900 p-6 shadow-md flex flex-col items-start justify-center rounded-tl-md rounded-tr-md lg:rounded-tr-none rounded-bl-md'>
          <Calendar
            className={`mb-4 !text-zinc-600 dark:!text-zinc-400`}
            size={24}
          />
          <h3 className='text-xl font-semibold mb-2'>Deadline</h3>
          <p className='text-sm'>
            Submissions close on{' '}
            <b>
              {new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: hackathon.timezone,
              }).format(new Date(hackathon.content.submission_deadline))}
            </b>
            , at{' '}
            <b>
              {new Intl.DateTimeFormat('en-US', {
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
            Requirements
          </h3>
          <p className='text-sm text-zinc-50'>
            Your project must include a GitHub repo, slides for your pitch, and any additional content.
          </p>
        </div>

        <div className='bg-zinc-200 dark:bg-zinc-900 p-6 shadow-md flex flex-col items-start justify-center'>
          <Trophy
            size={24}
            className={`mb-4 !text-zinc-600 dark:!text-zinc-400`}
          />
          <h3 className='text-xl font-semibold mb-2'>Evaluation Criteria</h3>
          <p className='text-sm'>
            Projects will be judged on value proposition, technical complexity
            and usage of Avalanche technologies
          </p>
        </div>

        <div className='bg-zinc-700 dark:bg-zinc-800 p-6 shadow-md flex flex-col items-start justify-center lg:rounded-tr-md rounded-bl-md lg:rounded-bl-none rounded-br-md'>
          <Rocket
            size={24}
            className={`mb-4 !text-zinc-200 dark:!text-zinc-400`}
          />
          <h3 className='text-xl font-semibold mb-2 text-zinc-50'>
            Submission Process
          </h3>
          <p className='text-sm text-zinc-50'>
            Submit your project through the Avalanche Builders Hub, add your
            team members, and upload your GitHub repo, presentation slides along with any other file that support your submission.
          </p>
        </div>
      </div>

      <div className='flex justify-center mt-8 gap-4'>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='red' className='text-s w-2/5 md:w-1/3 lg:w-1/4 cursor-pointer'>
              View full guidelines
            </Button>
          </DialogTrigger>
          <DialogContent className='dark:bg-zinc-900 bg-zinc-50'>
            <div className='max-w-lg text-white rounded-2xl'>
              <div className='flex items-center space-x-3'>
                <div className='p-2 bg-red-500 rounded-full'>
                  <Trophy size={24} color='#F5F5F9' />
                </div>
                <h1 className='text-3xl font-semibold'>Guidelines</h1>
              </div>
              <span className='block w-full h-[1px] my-8 bg-red-500'></span>
              <div className='prose text-zinc-50'>
                <MDXRemote source={hackathon.content.judging_guidelines} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button asChild variant='red' className='w-2/5 md:w-1/3 lg:w-1/4'>
          <Link
            href={
              hackathon.content.submission_custom_link
                ? hackathon.content.submission_custom_link
                : `/hackathons/submit-project?hackaId=${hackathon.id}`
            }
            target={
              hackathon.content.submission_custom_link ? '_blank' : '_self'
            }
            className='text-s sm:text-base'
          >
            Submit project
          </Link>
        </Button>
      </div>
    </section>
  );
}
