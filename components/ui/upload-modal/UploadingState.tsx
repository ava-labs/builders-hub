import { Button } from '@/components/ui/button';

interface UploadingStateProps {
  onCancel?: () => void;
}

export function UploadingState({ onCancel }: UploadingStateProps) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 border-2 border-red-500 rounded-lg p-8 text-center cursor-pointer bg-gray-100 dark:bg-zinc-800 animate-in fade-in slide-in-from-bottom-4'>
      <div className='w-full bg-gray-200 dark:bg-zinc-400 rounded-full h-4'>
        <div className='bg-red-500 h-4 rounded-full w-3/4 animate-pulse'></div>
      </div>
      <p className='text-center text-gray-500 dark:text-zinc-400'>
        Uploading...
      </p>
      <Button
        className='w-fit'
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
} 