'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Separator } from '@/components/ui/separator';
import { PlusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectValue,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

const profileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  bio: z.string().max(250, 'Bio must not exceed 250 characters').optional(),
  email: z.string().email('Invalid email'),
  profilePicture: z.string().optional(),
  accounts: z.array(z.string()).optional(),
  emailNotifications: z.boolean().optional(),
  profilePrivacy: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function Profile() {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: '',
      email: '',
      bio: '',
      accounts: [],
      profilePicture: '',
      emailNotifications: false,
      profilePrivacy: 'public',
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      console.log(data);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  return (
    <div className='container mx-auto py-8 flex flex-col gap-4'>
      <div>
        <h2 className='text-2xl font-semibold mb-2'>Settings</h2>
        <p className='text-sm text-muted-foreground'>
          Edit and manage all aspects of your hackathon in one place.
        </p>
      </div>

      <Separator className='my-6' />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
          <div>
            <h3 className='text-lg font-medium'>Personal Information</h3>
            <p className='text-sm text-muted-foreground'>
              Manage your user settings and privacy details of your hackathon.
            </p>
          </div>
          <Separator className='my-6' />

          <FormField
            control={form.control}
            name='fullName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name in Hackathon</FormLabel>
                <FormControl>
                  <Input placeholder='Enter your full name' {...field} />
                </FormControl>
                <FormDescription>
                  This name will be displayed on your profile and submissions.
                </FormDescription>
              </FormItem>
            )}
          />

          <div className='space-y-4'>
            <FormLabel>Profile Picture</FormLabel>
            <div className='flex flex-col gap-4'>
              <div className='w-24 h-24 border-2 border-dashed border-red-500 rounded-lg flex items-center justify-center'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='24'
                  height='24'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <rect width='18' height='18' x='3' y='3' rx='2' ry='2' />
                  <circle cx='9' cy='9' r='2' />
                  <path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' />
                </svg>
              </div>
              <Button className='w-fit' type='button'>
                Upload or update your profile image
              </Button>
            </div>
            <FormDescription>
              File Requirements:
              <ul className='list-disc list-inside text-xs mt-1'>
                <li>Supported formats: PNG, JPG, GIF</li>
                <li>Maximum file size: 5MB</li>
                <li>Max file size: 1MB</li>
              </ul>
            </FormDescription>
          </div>

          <FormField
            control={form.control}
            name='bio'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Tell others about yourself in a few words'
                    className='resize-none h-24'
                    maxLength={250}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  250 characters. Highlight your background, interests, and
                  experience.
                </FormDescription>
              </FormItem>
            )}
          />

          <Separator />

          <div>
            <h3 className='text-lg font-medium'>Account & Security</h3>
            <p className='text-sm text-muted-foreground'>
              Manage your email settings and privacy details of your hackathon.
            </p>
          </div>

          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input placeholder='your@email.com' type='email' {...field} />
                </FormControl>
                <FormDescription>
                  To update your email, a verification code will be sent to your
                  current email.
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='accounts'
            render={({ field }) => (
              <FormItem>
                <div>
                  <h4 className='text-sm font-medium mb-2'>
                    Connect Your Accounts
                  </h4>
                  <p className='text-sm text-muted-foreground mb-4'>
                    Add your social media or professional links
                  </p>
                </div>
                <FormControl>
                  <div className='space-y-2'>
                    <AnimatePresence initial={false}>
                      {Array.isArray(field.value) &&
                        field.value.length > 0 &&
                        field.value.map((account, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              transition: {
                                duration: 0.1,
                              },
                            }}
                            exit={{
                              opacity: 0,
                              scale: 0.95,
                              transition: {
                                duration: 0.1,
                              },
                            }}
                            className='flex items-center gap-2'
                          >
                            <Input
                              value={account}
                              onChange={(e) => {
                                const newAccounts = [...(field.value || [])];
                                newAccounts[index] = e.target.value;
                                field.onChange(newAccounts);
                              }}
                              placeholder='https://'
                            />
                            <motion.button
                              type='button'
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.preventDefault();
                                const newAccounts =
                                  field.value?.filter((_, i) => i !== index) ||
                                  [];
                                field.onChange(newAccounts);
                              }}
                              className='p-2 hover:bg-gray-100 rounded-full dark:hover:bg-gray-800 cursor-pointer'
                            >
                              <svg
                                width='15'
                                height='15'
                                viewBox='0 0 15 15'
                                fill='none'
                                xmlns='http://www.w3.org/2000/svg'
                              >
                                <path
                                  d='M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z'
                                  fill='currentColor'
                                  fillRule='evenodd'
                                  clipRule='evenodd'
                                ></path>
                              </svg>
                            </motion.button>
                          </motion.div>
                        ))}
                    </AnimatePresence>
                  </div>
                </FormControl>
                <Button
                  type='button'
                  className='w-fit justify-start mt-2'
                  onClick={(e) => {
                    e.preventDefault();
                    field.onChange([...(field.value || []), '']);
                  }}
                >
                  <PlusCircle className='stroke-white dark:stroke-black mr-2' />
                  Add another
                </Button>
              </FormItem>
            )}
          />

          <Separator />

          <FormField
            control={form.control}
            name='profilePrivacy'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile Privacy</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select privacy setting' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='public'>Public (Visible to everyone)</SelectItem>
                      <SelectItem value='private'>Private</SelectItem>
                      <SelectItem value='community'>Community-only</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Choose who can see your profile
                </FormDescription>
              </FormItem>
            )}
          />

          <Separator />

          <div>
            <h3 className='text-lg font-medium'>Notifications</h3>
            <p className='text-sm text-muted-foreground'>
              Manage the basic settings and primary details of your hackathon.
            </p>
          </div>

          <FormField
            control={form.control}
            name='emailNotifications'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Notifications</FormLabel>
                <FormControl>
                  <Select
                    value={field.value ? 'enabled' : 'disabled'}
                    onValueChange={(value) =>
                      field.onChange(value === 'enabled')
                    }
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Select notification preference' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='enabled'>Enabled</SelectItem>
                      <SelectItem value='disabled'>Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  Choose from Hackathon reminders, new opportunities, and
                  community updates.
                </FormDescription>
              </FormItem>
            )}
          />

          <Separator className='mb-6' />

          <div className='flex justify-start items-center gap-4 pt-6'>
            <Button type='submit' className='py-2 px-4' variant='red'>
              Save Changes
            </Button>
            <Button type='button' className='py-2 px-4' variant='outline'>
              Cancel Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default Profile;
