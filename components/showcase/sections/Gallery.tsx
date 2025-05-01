import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

type Props = {
  projectGallery: string[];
};

export default function Gallery({ projectGallery }: Props) {
  return (
    <div>
      <h2 className='text-2xl'>Gallery</h2>
      <Separator className='my-4 bg-zinc-300 dark:bg-zinc-800' />
      <div className='relative'>
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className='w-full'
        >
          <CarouselContent>
            {projectGallery.map(
              (image, index) =>
                image && (
                  <CarouselItem
                    key={index}
                    className='md:basis-1/2 lg:basis-1/3'
                  >
                    <div className='flex justify-center'>
                      <Image
                        src={image}
                        alt={`Gallery Image ${index + 1}`}
                        width={241}
                        height={241}
                        className='rounded-md w-[100px] h-[100px] sm:w-[200px] sm:h-[200px] lg:w-[241px] lg:h-[241px] object-cover'
                      />
                    </div>
                  </CarouselItem>
                )
            )}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}
