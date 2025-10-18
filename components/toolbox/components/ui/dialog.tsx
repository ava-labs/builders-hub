import React, { useEffect } from 'react';
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

// Custom Dialog Root component that handles pointer-events cleanup
interface DialogRootProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DialogRoot: React.FC<DialogRootProps> = ({ children, open, onOpenChange }) => {
  // Fix for pointer-events issue: Ensure body pointer-events are restored when modal closes
  useEffect(() => {
    return () => {
      // Cleanup function to restore body pointer-events when component unmounts
      const restoreBodyPointerEvents = () => {
        document.body.style.pointerEvents = '';
      };
      
      // Use setTimeout to ensure this runs after Radix Dialog cleanup
      setTimeout(restoreBodyPointerEvents, 0);
    };
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Restore body pointer-events immediately when closing
      document.body.style.pointerEvents = '';
    }
    onOpenChange?.(newOpen);
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange}>
      {children}
    </RadixDialog.Root>
  );
};

// Export all Radix Dialog components with our custom Root
export const Dialog = {
  Root: DialogRoot,
  Portal: RadixDialog.Portal,
  Overlay: RadixDialog.Overlay,
  Content: RadixDialog.Content,
  Title: RadixDialog.Title,
  Description: RadixDialog.Description,
  Close: RadixDialog.Close,
  Trigger: RadixDialog.Trigger,
};

// Convenience components with good defaults
interface DialogContentProps extends React.ComponentProps<typeof RadixDialog.Content> {
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export const DialogContent: React.FC<DialogContentProps> = ({ 
  children, 
  showCloseButton = true,
  className,
  ...props 
}) => {
  return (
    <Dialog.Content 
      className={cn(
        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-lg focus:outline-none w-[90vw] max-w-md max-h-[80vh] overflow-y-auto z-[10000]",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Dialog.Close asChild>
          <button
            className="absolute top-3 right-3 text-zinc-500 hover:text-black dark:hover:text-white p-1 rounded-full cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </Dialog.Close>
      )}
    </Dialog.Content>
  );
};

export const DialogOverlay: React.FC<React.ComponentProps<typeof RadixDialog.Overlay>> = (props) => {
  return (
    <Dialog.Overlay 
      className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow z-[9999]" 
      {...props} 
    />
  );
};

export const DialogTitle: React.FC<React.ComponentProps<typeof RadixDialog.Title>> = ({ 
  className, 
  ...props 
}) => {
  return (
    <Dialog.Title 
      className={cn("text-xl font-bold mb-6 text-zinc-800 dark:text-zinc-100", className)} 
      {...props} 
    />
  );
};
