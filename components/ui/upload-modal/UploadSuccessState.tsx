import { Button } from '@/components/ui/button';
import { BadgeCheck } from 'lucide-react';

interface UploadSuccessStateProps {
  onClose: () => void;
}

export function UploadSuccessState({ onClose }: UploadSuccessStateProps) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 border-2 border-red-500 rounded-lg p-8 text-center cursor-pointer bg-gray-100 dark:bg-zinc-800 animate-in fade-in slide-in-from-bottom-4'>
      <div className='flex items-center justify-center'>
        <BadgeCheck size={36} className='text-red-500' />
      </div>
      <p className='text-black dark:text-white text-lg'>
        Success! Your image is now saved.
      </p>
      <Button 
        className='bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-100 border-none w-fit mx-auto'
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  );
} 