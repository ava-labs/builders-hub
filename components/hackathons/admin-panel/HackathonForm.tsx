'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, GalleryVerticalEnd, Loader2 } from 'lucide-react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import AdminSidebar from './AdminSidebar';
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
      const payload = {
        ...initialData,
        tags: ['AI', 'Gaming'],
        date: new Date().toISOString(),
        title: values.name,
        description: values.description,
        location: values.location,
        registration_deadline: values.registrationDeadline,
        agenda: [
          {
            date: '2024-12-06T10:00:00.000Z',
            name: 'Activity 1 for Hackathon 8',
            stage: 'Stage 1',
            duration: '1 hour',
            description: 'Description for Activity 1',
          },
          {
            date: '2024-12-06T12:00:00.000Z',
            name: 'Activity 2 for Hackathon 8',
            stage: 'Stage 2',
            duration: '1 hour',
            description: 'Description for Activity 2',
          },
          {
            date: '2024-12-06T14:00:00.000Z',
            name: 'Activity 3 for Hackathon 8',
            stage: 'Stage 3',
            duration: '1 hour',
            description: 'Description for Activity 3',
          },
        ],
        partners: [
          {
            logo: 'https://example.com/logos/partner-1.png',
            name: 'TechCorp',
            about: 'About TechCorp',
            links: [
              {
                icon: 'https://example.com/icons/partner-link-1.png',
                link: 'https://www.techcorp.com/link-1',
                name: 'Partner Link 1',
              },
              {
                icon: 'https://example.com/icons/partner-link-2.png',
                link: 'https://www.techcorp.com/link-2',
                name: 'Partner Link 2',
              },
            ],
          },
          {
            logo: 'https://example.com/logos/partner-2.png',
            name: 'InnovateX',
            about: 'About InnovateX',
            links: [
              {
                icon: 'https://example.com/icons/partner-link-1.png',
                link: 'https://www.innovatex.com/link-1',
                name: 'Partner Link 1',
              },
              {
                icon: 'https://example.com/icons/partner-link-2.png',
                link: 'https://www.innovatex.com/link-2',
                name: 'Partner Link 2',
              },
            ],
          },
        ],
        tracks: [
          {
            name: 'Healthcare Track',
            prizes: [
              {
                name: 'Prize 1',
                type: 'Pool',
                rewards: [100, 200, 300],
                criteria: 'Criteria for Prize 1',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 1',
              },
              {
                name: 'Prize 2',
                type: 'Ranked',
                rewards: [150, 250, 350],
                criteria: 'Criteria for Prize 2',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 2',
              },
              {
                name: 'Prize 3',
                type: 'Pool',
                rewards: [200, 300, 400],
                criteria: 'Criteria for Prize 3',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 3',
              },
            ],
            partner: 'TechCorp',
            resources: [
              {
                icon: 'https://example.com/icons/track-resource-1.png',
                link: 'https://example.com/track-resource-1',
                name: 'Track Resource 1',
              },
              {
                icon: 'https://example.com/icons/track-resource-2.png',
                link: 'https://example.com/track-resource-2',
                name: 'Track Resource 2',
              },
            ],
            description: 'Description for Healthcare track',
            total_reward: 2250,
          },
          {
            name: 'Finance Track',
            prizes: [
              {
                name: 'Prize 1',
                type: 'Pool',
                rewards: [100, 200, 300],
                criteria: 'Criteria for Prize 1',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 1',
              },
              {
                name: 'Prize 2',
                type: 'Ranked',
                rewards: [150, 250, 350],
                criteria: 'Criteria for Prize 2',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 2',
              },
              {
                name: 'Prize 3',
                type: 'Pool',
                rewards: [200, 300, 400],
                criteria: 'Criteria for Prize 3',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 3',
              },
            ],
            partner: 'InnovateX',
            resources: [
              {
                icon: 'https://example.com/icons/track-resource-1.png',
                link: 'https://example.com/track-resource-1',
                name: 'Track Resource 1',
              },
              {
                icon: 'https://example.com/icons/track-resource-2.png',
                link: 'https://example.com/track-resource-2',
                name: 'Track Resource 2',
              },
            ],
            description: 'Description for Finance track',
            total_reward: 2250,
          },
          {
            name: 'Education Track',
            prizes: [
              {
                name: 'Prize 1',
                type: 'Pool',
                rewards: [100, 200, 300],
                criteria: 'Criteria for Prize 1',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 1',
              },
              {
                name: 'Prize 2',
                type: 'Ranked',
                rewards: [150, 250, 350],
                criteria: 'Criteria for Prize 2',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 2',
              },
              {
                name: 'Prize 3',
                type: 'Pool',
                rewards: [200, 300, 400],
                criteria: 'Criteria for Prize 3',
                resources: [
                  {
                    icon: 'https://example.com/icons/resource-1.png',
                    link: 'https://example.com/resource-1',
                    name: 'Resource 1',
                  },
                  {
                    icon: 'https://example.com/icons/resource-2.png',
                    link: 'https://example.com/resource-2',
                    name: 'Resource 2',
                  },
                ],
                description: 'Description for Prize 3',
              },
            ],
            partner: 'CodeLabs',
            resources: [
              {
                icon: 'https://example.com/icons/track-resource-1.png',
                link: 'https://example.com/track-resource-1',
                name: 'Track Resource 1',
              },
              {
                icon: 'https://example.com/icons/track-resource-2.png',
                link: 'https://example.com/track-resource-2',
                name: 'Track Resource 2',
              },
            ],
            description: 'Description for Education track',
            total_reward: 2250,
          },
        ],
      };
      if (isEditing) {
        await axios.put(`/api/hackathons/${initialData!.id}`, payload);
        toast({
          title: 'Hackathon updated successfully',
        });
      } else {
        await axios.post(`/api/hackathons/`, payload);
        toast({
          title: 'Hackathon created successfully',
        });
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
      registrationDeadline: initialData?.content.registration_deadline
        ? new Date(initialData.content.registration_deadline)
        : undefined,
    },
  });

  return (
    <section className='px-4 sm:px-8 py-4 sm:py-6'>
      <h1 className='font-medium text-base sm:text-lg text-zinc-50'>
        Hackathon Admin Panel
      </h1>
      <p className='text-sm sm:text-base text-zinc-400'>
        Edit and manage all aspects of your hackathon in one place.
      </p>
      <hr className='my-4 border-t border-zinc-800' />
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-4'>
        <div className='w-full sm:w-auto py-2 px-3 flex flex-row items-center gap-2 rounded-md border-zinc-800 border'>
          <GalleryVerticalEnd className='w-4 h-4 stroke-white' />
          <span className='text-sm sm:text-base'>Hackathon Admin Panel</span>
        </div>
        <div className='flex flex-col sm:flex-row gap-4 justify-start sm:justify-end items-stretch sm:items-center w-full sm:w-auto'>
          <Button
            variant='secondary'
            onClick={form.handleSubmit(onSubmit)}
            className='bg-red-500 hover:bg-red-600 py-2 px-4 w-full sm:w-auto'
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
            onClick={() => router.push(`/hackathons/${initialData?.id ?? ''}`)}
            className='w-full sm:w-auto'
          >
            View Public Page
          </Button>
          <Button variant='secondary' className='w-full sm:w-auto'>
            Publish
          </Button>
          <div className='hidden sm:block border-l border-zinc-800 h-8'></div>
          <Badge
            variant='outline'
            className='px-3 flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start'
          >
            Status: Live
            <Circle className='w-3 h-3 stroke-green-500' />
          </Badge>
        </div>
      </div>
      <div className='relative'>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset className='p-2 pl-4 max-w-full sm:pl-6 flex flex-col md:max-h-[70vh] md:overflow-y-auto'>
            <Form {...form}>
              <form
                className='pb-16 sm:pb-24 w-full'
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <General form={form} />
              </form>
            </Form>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </section>
  );
}
