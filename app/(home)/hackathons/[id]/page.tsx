import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getFilteredHackathons,
  getHackathon,
} from '@/server/services/hackathons';
import Image from 'next/image';
import { NavigationMenu } from '@/components/hackathons/NavigationMenu';
import Schedule from '@/components/hackathons/hackathon/sections/Schedule';
import Tracks from '@/components/hackathons/hackathon/sections/Tracks';
import Sponsors from '@/components/hackathons/hackathon/sections/Sponsors';
import Submission from '@/components/hackathons/hackathon/sections/Submission';
import Resources from '@/components/hackathons/hackathon/sections/Resources';
import Community from '@/components/hackathons/hackathon/sections/Community';
import MentorsJudges from '@/components/hackathons/hackathon/sections/MentorsJudges';
import OverviewBanner from '@/components/hackathons/hackathon/sections/OverviewBanner';
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { hackathons } = await getFilteredHackathons({});
  return hackathons.map((hackathon) => ({
    id: hackathon.id,
  }));
}

export default async function HackathonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hackathon = await getHackathon(id);

  const menuItems = [
    { name: 'Prizes & Tracks', ref: 'tracks' },
    { name: 'Resources', ref: 'resources' },
    { name: 'Schedule', ref: 'schedule' },
    { name: 'Submission', ref: 'submission' },
    { name: 'Mentors & Judges', ref: 'speakers' },
    { name: 'Partners', ref: 'sponsors' },
  ];

  if (!hackathon) redirect('/hackathons');

  return (
    <main className='container sm:px-2 py-4 lg:py-16'>
      <div className='pl-4 flex gap-4 items-center'>
        <Image
          src={hackathon.icon}
          alt='Hackathon background'
          width={40}
          height={40}
        />
        <span className='text-sm sm:text-xl font-bold'>{hackathon.title}</span>{' '}
        <Button
          asChild
          variant='secondary'
          className='w-1/4 bg-red-500 rounded-md text-zinc-100 text-s sm:text-base'
        >
          <Link
            href={
              hackathon.content.join_custom_link
                ? hackathon.content.join_custom_link
                : `/hackathons/registration-form?hackaId=${id}`
            }
            target={hackathon.content.join_custom_link ? '_blank' : '_self'}
          >
            {hackathon.content.join_custom_text ?? 'Join now'}
          </Link>
        </Button>
      </div>
      <div className='p-4 flex flex-col gap-24'>
        <NavigationMenu items={menuItems} />
      </div>
      <div className='flex flex-col mt-2 '>
        <div className='sm:px-8 pt-6 '>
          <div className='sm:block relative w-full'>
            <OverviewBanner hackathon={hackathon} id={id} />
            <Link
              href={
                hackathon.content.join_custom_link
                  ? hackathon.content.join_custom_link
                  : `/hackathons/registration-form?hackaId=${id}`
              }
              target={hackathon.content.join_custom_link ? '_blank' : '_self'}
            >
              <Image
                src={hackathon.banner}
                alt='Hackathon background'
                width={1270}
                height={760}
                className='w-full h-full'
                priority
              />
            </Link>
          </div>
          <div className='py-8 sm:p-8 flex flex-col gap-20'>
            {hackathon.content.tracks && <Tracks hackathon={hackathon} />}
            <Resources hackathon={hackathon} />
            {hackathon.content.schedule && <Schedule hackathon={hackathon} />}
            <Submission hackathon={hackathon} />
            {hackathon.content.speakers && (
              <MentorsJudges hackathon={hackathon} />
            )}
            <Community hackathon={hackathon} />
            {hackathon.content.partners && <Sponsors hackathon={hackathon} />}
          </div>
        </div>
      </div>
      {/* <div className="flex justify-end mt-4">
        <Link href={`/hackathons/${id}/admin-panel`}>
          <Button>Edit Hackathon</Button>
        </Link>
      </div> */}
    </main>
  );
}
