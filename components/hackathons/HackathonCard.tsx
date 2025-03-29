import { Trophy, UserRound } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { MapPinIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { HackathonHeader } from '@/types/hackathons';
import { Button } from '../ui/button';
import HackathonStatus from './hackathon/HackathonStatus';
import { Badge } from '../ui/badge';

export default function HackathonCard({
  hackathon,
}: {
  hackathon: HackathonHeader;
}) {
  return (
    <div
      key={hackathon.id}
      className='flex rounded-lg shadow-lg h-400px md:h-[340px] border border-zinc-300 dark:border-transparent'
    >
      {/* Left Section: Background Image or Red Color */}
      <Link
        href={
          hackathon.id == '26bfce9b-4d44-4d40-8fbe-7903e76d48fa'
            ? '/hackathon'
            : `/hackathons/${hackathon.id}`
        }
      >
        <Image
          src={hackathon.small_banner}
          alt='Avalanche Logo'
          className='rounded-l-md hidden md:block h-full'
          width={200}
          height={280}
        />
      </Link>

      {/* Right Section */}
      <div className='flex-1 justify-evenly bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 p-6 flex flex-col gap-1 rounded-md md:rounded-l-none'>
        <h2 className='uppercase font-bold text-2xl'>
          {hackathon.title.length < 45
            ? hackathon.title
            : hackathon.title.slice(0, 40) + '...'}
        </h2>

        <div className='flex items-center gap-2 dark:text-zinc-300 text-zinc-600 text-sm mt-2'>
          <CalendarIcon className='h-4 w-4 dark:stroke-zinc-50 stroke-zinc-900' />
          <span className='font-medium'>
            {new Date(hackathon.start_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <MapPinIcon className='h-3 w-3 dark:stroke-zinc-50 stroke-zinc-900' />
          <p className='text-xs dark:text-zinc-300 text-zinc-800'>
            {hackathon.location}
          </p>
        </div>
        {/* Tags Section */}
        {hackathon.tags && hackathon.tags.length > 0 && (
          <div className='mt-4 flex flex-wrap gap-2'>
            {hackathon.tags.map((tag: string) => (
              <Badge key={tag} className='rounded-full'>
                <p className='text-sm'>{tag}</p>
              </Badge>
            ))}
          </div>
        )}
        <div className='flex flex-wrap gap-y-2 justify-around items-center text-gray-300 text-sm py-[10px]'>
          <div className='flex items-center gap-1 md:gap-2'>
            <Trophy className='h-4 w-4 dark:stroke-zinc-50 stroke-zinc-900' />
            <span className='font-medium dark:text-zinc-50 text-zinc-900'>
              ${hackathon.total_prizes.toLocaleString('en-US')}
            </span>
          </div>
          <div className='flex items-center gap-1 md:gap-2'>
            <UserRound className='h-4 w-4 dark:stroke-zinc-50 stroke-zinc-900' />
            <span className='font-medium dark:text-zinc-50 text-zinc-900'>
              {hackathon.participants}
            </span>
          </div>
          <div className='flex items-center gap-1 md:gap-2'>
            <HackathonStatus
              status={hackathon.status ?? 'UPCOMING'}
              enableLightMode={true}
            />
          </div>
        </div>
        <Button
          asChild
          variant='secondary'
          className='w-full bg-red-500 py-2 px-4'
        >
          <Link
            className='text-sm text-zinc-50'
            href={
              hackathon.id == '26bfce9b-4d44-4d40-8fbe-7903e76d48fa'
                ? '/hackathon'
                : `/hackathons/${hackathon.id}`
            }
          >
            LEARN MORE
          </Link>
        </Button>
      </div>
    </div>
  );
}
