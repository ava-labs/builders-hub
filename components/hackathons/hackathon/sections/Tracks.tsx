import { HackathonHeader } from '@/types/hackathons';
import { Crown } from 'lucide-react';
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import TrackCard from '../TrackCard';
import TrackDialogContent from '../TrackDialogContent';

function Tracks({ hackathon }: { hackathon: HackathonHeader }) {
  return (
    <section>
      <h2 className='text-4xl font-bold mb-8' id='tracks'>
        Prizes & Tracks
      </h2>
      <Separator className='my-8 bg-zinc-300 dark:bg-zinc-800' />
      <div className='pt-5 pb-5'>
        <p>{hackathon.content.tracks_text}</p>
      </div>
      <div className='relative py-32 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-24 grid-flow-row'>
        <div className='absolute -z-10 w-screen h-full left-1/2 transform -translate-x-1/2 bg-zinc-200' />
        <Card className='w-[200px] sm:w-[356px] absolute top-[-80px] left-1/2 transform -translate-x-1/2  bg-red-300 rounded-xl border-2 border-red-500'>
          <CardHeader className='justify-center items-center'>
            <div className='p-2 rounded-full bg-white'>
              <Crown color='#FF394A' />
            </div>
          </CardHeader>
          <CardContent className='flex flex-col items-center justify-center'>
            <span className='text-xl font-bold text-zinc-900'>
              ${hackathon.total_prizes.toLocaleString('en-US')}
            </span>
            <span className='text-sm text-zinc-900'>Total price pool</span>
          </CardContent>
        </Card>
          {hackathon.content.tracks.map((track, index) => (
            <Dialog>
              <DialogTrigger>
                <TrackCard key={index} track={track} />
              </DialogTrigger>
              <DialogContent className='dark:bg-zinc-900 bg-zinc-50'>
                <DialogTitle />
                <TrackDialogContent track={track} />
              </DialogContent>
            </Dialog>
          ))}
      </div>
    </section>
  );
}

export default Tracks;
