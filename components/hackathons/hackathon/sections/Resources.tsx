import React from 'react';
import { HackathonHeader } from '@/types/hackathons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@radix-ui/react-dropdown-menu';
import { DynamicIcon } from 'lucide-react/dynamic';
import { Link } from 'lucide-react';

function Resources({ hackathon }: { hackathon: HackathonHeader }) {
  return (
    <section className='text-black dark:text-white dark:bg-black py-12'>
      <h2 className='text-4xl font-bold mb-6' id='resources'>
        Resources
      </h2>
      <Separator className='my-8 h-[1px] bg-zinc-300 dark:bg-zinc-800' />
      <p className='text-lg text-gray-600 dark:text-gray-300 mb-6'>
        Unlock incredible rewards for your innovation and skills in{' '}
        {hackathon.title}
      </p>

      <div className='grid gap-3'>
        {hackathon.content.resources.map((resource, index) => (
          <Card key={index} className='hover:border-gray-500 dark:hover:border-gray-600 transition cursor-pointer'>
            <CardContent className='flex flex-row gap-4 items-center'>
              <div>
                <DynamicIcon
                  name={resource.icon as any}
                  size={16}
                  className='!text-zinc-900 dark:!text-zinc-50'
                />
              </div>
              <div>
                <a href={resource.link} target='_blank'>
                  <h3 className='text-[#FF394A] text-base font-semibold'>
                    {resource.title}
                  </h3>
                </a>
                <p className='text-gray-600 dark:text-gray-400 text-sm leading-tight'>
                  {resource.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* <p className="text-lg text-gray-600 dark:text-gray-300 mt-8">
        Need deeper insights? Access the full set of Avalanche documentation,
        tools, and developer guides.
      </p>

      <div className="flex justify-center mt-8">
        <Button
          variant="secondary"
          className="w-1/3 bg-red-500 rounded-md text-zinc-100"
        >
          Explore Full Documentation & Tools
        </Button>
      </div> */}
    </section>
  );
}
export default Resources;
