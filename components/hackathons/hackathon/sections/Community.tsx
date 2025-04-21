import { HackathonHeader } from '@/types/hackathons';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DynamicIcon } from 'lucide-react/dynamic';
import Link from 'next/link';

const communityResources = [
  {
    title: 'Join the Telegram chat',
    icon: 'send',
    link: 'https://t.me/avalancheacademy',
  },
  {
    title: 'Avalanche Team1 X',
    icon: 'bird',
    link: 'https://x.com/AvaxTeam1',
  },
];

function Community({ hackathon }: { hackathon: HackathonHeader }) {
  return (
    <section className='text-black dark:text-white py-12'>
      <h2 className='text-4xl font-bold mb-6'>Community</h2>
      <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800' />
      <p className='text-lg text-gray-600 dark:text-gray-400 mb-6'>
        Connect with fellow hackers, mentors, and experts. Get real-time
        support, network with industry leaders, and make the most of your
        hackathon experience.
      </p>

      <div className='flex flex-col gap-8'>
        <div className='flex flex-col items-center md:flex-row justify-center gap-8'>
          {communityResources.map((item, index) => (
            <Link
              key={index}
              href={item.link}
              target='_blank'
              rel='noopener noreferrer'
              className='w-full'
            >
              <Card className='hover:border-gray-500 dark:hover:border-gray-600 transition flex-1 rounded-lg py-2 '>
                <CardContent className='w-full flex flex-row gap-4 items-center justify-start lg:justify-center p-4'>
                  <div className='p-3 flex items-center justify-center bg-red-500 rounded-full text-zinc-50'>
                    <DynamicIcon
                      name={item.icon as any}
                      color='#F5F5F9'
                      className='w-5 sm:w-7 h-5 sm:h-7'
                    />
                  </div>
                  <span className='text-black dark:text-white sm:text-lg font-semibold'>
                    {item.title}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* <div className='flex justify-center'>
        <Button
            asChild
            variant={'secondary'}
            className='w-fit px-6 bg-red-500 rounded-md text-zinc-100'
          >
            <a
              href='https://example.com/community'
              target='_blank'
              rel='noopener noreferrer'
            >
              <p className='lg:text-base'>EXPLORE COMMUNITY & NETWORKING</p>
            </a>
          </Button>
        </div> */}
      </div>
    </section>
  );
}

export default Community;
