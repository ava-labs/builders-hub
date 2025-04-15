import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Track } from '@/types/hackathons';
import { DynamicIcon } from 'lucide-react/dynamic';
import React from 'react';

type Props = {
  track: Track;
};

export default function TrackCard(props: Props) {
  return (
    <Card
      className='min-h-40 h-full bg-zinc-50 dark:bg-zinc-900 cursor-pointer rounded-xl'
    >
      <CardHeader>
        <CardTitle>
          <div className='flex justify-between items-center gap-2'>
            <h2 className='text-xl text-zinc-900 dark:text-zinc-50 font-bold'>
              {props.track.name}
            </h2>
            <DynamicIcon name={props.track.icon as any} size={16} className="dark:!text-zinc-400 !text-zinc-600" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className='dark:bg-zinc-900 bg-zinc-50'>
        <p className='text-sm text-zinc-600 dark:text-zinc-400 text-left'>
          {props.track.short_description}
        </p>
      </CardContent>
    </Card>
  );
}
