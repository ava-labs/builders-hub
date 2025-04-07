import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  message: string;
  subMessage?: string;
  onReplace: () => void;
}

export function ErrorState({ message, subMessage, onReplace }: ErrorStateProps) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 border-2 border-red-500 rounded-lg p-8 text-center cursor-pointer bg-zinc-800 animate-in fade-in slide-in-from-bottom-4'>
      <div className='flex items-center justify-center'>
        <div className='w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center'>
          <svg className='w-6 h-6 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
          </svg>
        </div>
      </div>
      <div className='space-y-1'>
        <p className='text-red-500 text-lg'>{message}</p>
        {subMessage && (
          <p className='text-sm text-zinc-400'>{subMessage}</p>
        )}
      </div>
      <Button 
        className='w-fit'
        onClick={onReplace}
      >
        Replace
      </Button>
    </div>
  );
} 