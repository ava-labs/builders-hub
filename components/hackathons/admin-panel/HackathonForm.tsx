'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GalleryVerticalEnd, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import General, { hackathonAdminFormSchema } from './sections/General';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import type {  HackathonHeader } from '@/types/hackathons';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';



export default function HackathonForm({
  initialData,
  isEditing = false,
}: {
  initialData?: HackathonHeader;
  isEditing?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  async function onSubmit(values: z.infer<typeof hackathonAdminFormSchema>) {
    try {
      setIsLoading(true);
      const payload: Record<string, unknown> = {
        ...initialData,
        title: values.name,
        description: values.description,
        location: values.location,
      };
      if (values.startDate) payload.start_date = values.startDate;
      if (values.endDate) payload.end_date = values.endDate;
      if (values.registrationDeadline) payload.registration_deadline = values.registrationDeadline;
      if (values.timeZone) payload.timezone = values.timeZone;
      if (typeof values.visibility === 'string') {
        payload.is_public = values.visibility === 'public';
      }
      if (isEditing) {
        await axios.put(`/api/events/${initialData!.id}`, payload);
        toast({
          title: 'Hackathon updated successfully',
        });
      } else {
        const createPayload = { ...payload, is_public: false };
        const response = await axios.post(`/api/events/`, createPayload);
        const newId = response?.data?.hackathon?.id;
        toast({
          title: 'Hackathon created — finish configuring it before publishing',
        });
        if (newId) {
          router.push(`/events/edit?event=${newId}`);
        }
      }
    } catch (error) {
      console.log(error);
      toast({
        title: 'Failed to update hackathon',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const form = useForm<z.infer<typeof hackathonAdminFormSchema>>({
    resolver: zodResolver(hackathonAdminFormSchema),
    defaultValues: {
      name: initialData?.title,
      description: initialData?.description,
      location: initialData?.location,
      registrationDeadline: initialData?.content?.registration_deadline
        ? new Date(initialData.content.registration_deadline)
        : undefined,
      startDate: initialData?.start_date ? new Date(initialData.start_date) : undefined,
      endDate: initialData?.end_date ? new Date(initialData.end_date) : undefined,
      timeZone: initialData?.timezone,
      visibility: initialData?.is_public === false ? 'private' : 'public',
    },
  });

  return (
    <section className='px-4 sm:px-8 py-4 sm:py-6'>
      <h1 className='font-medium text-base sm:text-lg text-foreground'>
        Hackathon Admin Panel
      </h1>
      <p className='text-sm sm:text-base text-muted-foreground'>
        Edit and manage all aspects of your hackathon in one place.
      </p>
      <hr className='my-4 border-t border-border' />
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-4'>
        <div className='w-full sm:w-auto py-2 px-3 flex flex-row items-center gap-2 rounded-md border-border border'>
          <GalleryVerticalEnd className='w-4 h-4' />
          <span className='text-sm sm:text-base'>Hackathon Admin Panel</span>
        </div>
        <div className='flex flex-col sm:flex-row gap-4 justify-start sm:justify-end items-stretch sm:items-center w-full sm:w-auto'>
          <Button
            variant='secondary'
            onClick={form.handleSubmit(onSubmit)}
            className='bg-red-500 hover:bg-red-600 text-white py-2 px-4 w-full sm:w-auto'
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className='animate-spin' />
                <span className='ml-2'>Saving...</span>
              </>
            ) : (
              'Save All Changes'
            )}
          </Button>
          <Button
            variant='secondary'
            onClick={() => router.push(`/events/${initialData?.id ?? ''}`)}
            className='w-full sm:w-auto'
          >
            View Public Page
          </Button>
        </div>
      </div>
      <div className='relative'>
        <Form {...form}>
          <form
            className='pb-16 sm:pb-24 w-full'
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <General form={form} />
          </form>
        </Form>
      </div>
    </section>
  );
}
