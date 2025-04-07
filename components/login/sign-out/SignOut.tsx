import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import Modal from '@/components/ui/Modal';
import { BadgeAlert } from 'lucide-react';
import React from 'react';

interface SignOutComponentProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function SignOutComponent({
  isOpen,
  onOpenChange,
  onConfirm,
}: SignOutComponentProps) {
  const content = (
    <Card
      className='
              my-4 w-[95%] sm:w-[85%] md:w-full max-h-[190px]
              rounded-md p-4 sm:p-6 gap-4 mx-auto
              text-black dark:bg-zinc-800 dark:text-white
              border border-red-500
            '
    >
      <CardContent className='flex flex-col items-center gap-4 pb-4'>
        <BadgeAlert color='rgb(239 68 68)' size='34' />
        <p className='text-red-600 dark:text-red-500 text-center text-base sm:text-lg'>
          Are you sure you want to sign out?
        </p>
      </CardContent>
      <CardFooter className='flex flex-col gap-2 w-full sm:flex-row sm:gap-4 sm:justify-center'>
        <Button
          onClick={onConfirm}
          className='
          w-full sm:w-auto px-4 py-2
        '
        >
          Yes, Sign Out
        </Button>

        <Button
          variant='ghost'
          className='
          w-full sm:w-auto px-4 py-2 underline
           cursor-pointer
        '
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title='Sign Out'
      content={content}
      className='border border-red-500'
    />
  );
}
