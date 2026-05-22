import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { format } from 'date-fns';



export const hackathonAdminFormSchema = z.object({
  name: z.string().min(1, 'The hackathon needs a name'),
  description: z
    .string()
    .min(10, 'The description must be at least 10 characters')
    .max(500, 'The description cannot exceed 500 characters'),
  logo: z.any().optional(),
  banner: z.any().optional(),

  format: z.enum(['on-site', 'virtual', 'hybrid']).optional(),
  location: z.string(),

  registrationDeadline: z.date().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  timeZone: z.string().optional(),

  totalPrizePool: z.string().optional(),

  visibility: z.enum(['public', 'private']).default('public'),

  status: z.enum(['draft', 'live', 'ended']).default('draft'),
});

function General({
  form,
}: {
  form: UseFormReturn<z.infer<typeof hackathonAdminFormSchema>>;
}) {
  return (
    <>
      <h3 className='font-medium text-2xl'>General Section</h3>
      <p className='text-zinc-400'>
        Manage the basic settings and primary details of your hackathon.
      </p>

      <hr className='my-4 border-t border-zinc-800' />
      {/* Hackathon Name */}
      <div className='flex flex-col gap-12 max-w-full'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hackathon Name</FormLabel>
              <FormControl>
                <Input
                  className='bg-transparent w-full'
                  placeholder='E.g., Avalanche Builder Hackathon'
                  {...field}
                  value={field.value?? ''}
                />
              </FormControl>
              <FormDescription className='text-zinc-400'>
                This is the name that will be displayed on the public hackathon
                page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Hackathon Description */}
        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hackathon Description</FormLabel>
              <FormControl>
                <Textarea
                  className='bg-transparent w-full'
                  placeholder='Provide a brief overview of the hackathon, its goals, and what participants can expect...'
                  maxLength={500}
                  {...field}
                  value={field.value?? ''}
                />
              </FormControl>
              <FormDescription className='text-zinc-400'>
                Keep it concise and clear (Max: 500 characters). Focus on
                objectives, themes, and any unique aspects of the hackathon.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Upload Hackathon Logo */}
        <FormField
          control={form.control}
          name='logo'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Upload Hackathon Logo</FormLabel>
              <FormControl>
                <Input
                  type='file'
                  accept='.png, .jpg, .svg'
                  className='w-full'
                  onChange={(e) => {
                    // Puedes guardar el File en el field si lo deseas
                    field.onChange(e.target.files?.[0]);
                  }}
                />
              </FormControl>
              <FormDescription className='text-zinc-400'>
                File Requirements:
                <br />
                • Supported formats: PNG, JPG, SVG
                <br />
                • Recommended size: 512 × 512px (square format)
                <br />• Max file size: 1MB
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Upload Hackathon Banner */}
        <FormField
          control={form.control}
          name='banner'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Upload Hackathon Banner</FormLabel>
              <FormControl>
                <Input
                  type='file'
                  accept='.png, .jpg'
                  className='w-full'
                  onChange={(e) => {
                    field.onChange(e.target.files?.[0]);
                  }}
                />
              </FormControl>
              <FormDescription className='text-zinc-400'>
                File Requirements:
                <br />
                • Supported formats: PNG, JPG <br />
                • Recommended size: 1270 &times; 760px <br />• Max file size:
                2MB
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <hr className='my-4 border-t border-zinc-800' />

        {/* Hackathon Format */}
        <FormField
          control={form.control}
          name='format'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hackathon Format</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className='bg-transparent w-full'>
                    <SelectValue placeholder='Select hackathon format' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='on-site'>
                    On-site (Participants must attend physically)
                  </SelectItem>
                  <SelectItem value='virtual'>
                    Virtual (Participants join online)
                  </SelectItem>
                  <SelectItem value='hybrid'>
                    Hybrid (Both on-site and virtual options)
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className='text-zinc-400'>
                Choose whether the hackathon will be held virtual, on-site, or
                in a hybrid format.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location */}
        <FormField
          control={form.control}
          name='location'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input
                  className='bg-transparent w-full'
                  placeholder='Enter the venue or city where the hackathon will take place'
                  {...field}
                  value={field.value?? ''}
                />
              </FormControl>
              <FormDescription className='text-zinc-400'>
                Specify the exact location if it&apos;s an on-site or hybrid
                hackathon.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Registration Deadline */}
        <FormField
          control={form.control}
          name='registrationDeadline'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Registration Deadline (Date &amp; Time)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      className={cn(
                        'pl-3 text-left font-normal w-full overflow-hidden',
                        !field.value && 'text-zinc-400'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span className="truncate max-w-full">MM/DD/YYYY HH:MM (12H format. Select AM/PM)</span>
                      )}
                      <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    className='bg-zinc-950'
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className='text-zinc-400'>
                Set the last date and time for participant registration. Must be
                before the hackathon start date.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hackathon Start Date */}
        <FormField
          control={form.control}
          name='startDate'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Hackathon Start Date (Date &amp; Time)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      className={cn(
                        'justify-start text-left font-normal w-full truncate',
                        !field.value && 'text-zinc-400'
                      )}
                    >
                      {field.value
                        ? format(field.value, 'MM/dd/yyyy hh:mm a')
                        : 'MM/DD/YYYY HH:MM (12H format. Select AM/PM)'}
                      <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    className='bg-zinc-950'
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className='text-zinc-400'>
                Set the official start date and time of the hackathon. Must be
                after the registration deadline.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hackathon End Date */}
        <FormField
          control={form.control}
          name='endDate'
          render={({ field }) => (
            <FormItem className='flex flex-col'>
              <FormLabel>Hackathon End Date (Date & Time)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant='outline'
                      className={cn(
                        'justify-start text-left font-normal w-full truncate',
                        !field.value && 'text-zinc-400'
                      )}
                    >
                      {field.value
                        ? format(field.value, 'MM/dd/yyyy hh:mm a')
                        : 'MM/DD/YYYY HH:MM (12H format. Select AM/PM)'}
                      <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    className='bg-zinc-950'
                    mode='single'
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className='text-zinc-400'>
                Set the official start date and time of the hackathon. Must be
                after the registration deadline.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Time Zone */}
        <FormField
          control={form.control}
          name='timeZone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Zone</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value ?? '(UTC-12:00) Baker Island'}
              >
                <FormControl>
                  <SelectTrigger className='bg-transparent w-full'>
                    <SelectValue placeholder='Select a time zone' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {/* Añade aquí las zonas horarias que necesites */}
                  <SelectItem value='(UTC-12:00) Baker Island, Howland Island'>
                    (UTC-12:00) Baker Island, Howland Island
                  </SelectItem>
                  <SelectItem value='(UTC+00:00) UTC'>
                    {' '}
                    (UTC+00:00) UTC{' '}
                  </SelectItem>
                  <SelectItem value='(UTC+05:30) India Standard Time'>
                    (UTC+05:30) India Standard Time
                  </SelectItem>
                  {/* etc... */}
                </SelectContent>
              </Select>
              <FormDescription className='text-zinc-400'>
                Select the official time zone for event scheduling. This will
                affect deadlines and submission times.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <hr className='my-4 border-t border-zinc-800' />

        {/* Hackathon Status */}
        <FormField
          control={form.control}
          name='visibility'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hackathon Visibility</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className='bg-transparent w-full'>
                    <SelectValue placeholder='Select visibility' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='public'>
                    Public (Visible to everyone)
                  </SelectItem>
                  <SelectItem value='private'>
                    Private (Invitation required)
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className='text-zinc-400'>
                Public events are visible to everyone. Private events require an
                invitation.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='status'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hackathon Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className='bg-transparent w-full'>
                    <SelectValue placeholder='Select hackathon status' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='draft'>
                    Draft (Not published yet, still being edited)
                  </SelectItem>
                  <SelectItem value='live'>
                    Live (Currently active and visible)
                  </SelectItem>
                  <SelectItem value='ended'>
                    Ended (Hackathon has concluded)
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className='text-zinc-400'>
                Select the current state of the hackathon. <br /> The status
                updates automatically based on the selected dates. You can
                override it manually if needed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}

export default General;
