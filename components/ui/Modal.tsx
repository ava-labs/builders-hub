import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  content?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function Modal({
  isOpen,
  onOpenChange,
  title,
  description,
  content,
  footer,
  className = '',
  contentClassName = '',
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          w-[95%] max-w-[450px] sm:w-[85%] sm:max-w-[500px] md:w-[70vw] md:max-w-[550px]
          border border-zinc-400 p-4 sm:p-6 gap-4 rounded-lg mx-auto
          bg-white text-black dark:bg-zinc-900 dark:text-white
          [&>button>svg]:text-zinc-500 dark:[&>button>svg]:text-zinc-400
          [&>button>svg:hover]:text-zinc-700 dark:[&>button>svg:hover]:text-zinc-300
          [&>button>svg]:w-7 [&>button>svg]:h-7
          ${className}
        `}
      >
        <DialogHeader className='gap-0'>
          <DialogTitle className='text-center font-bold text-lg sm:text-left'>
            {title}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        {description && (
          <DialogDescription className='text-center sm:text-left text-base sm:text-lg'>
            {description}
          </DialogDescription>
        )}

        {content}

        {footer && (
          <DialogFooter className='flex flex-col gap-2 w-full sm:flex-row sm:gap-4 sm:justify-center'>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
