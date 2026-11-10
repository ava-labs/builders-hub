'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from './utils';

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-zinc-950/40',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-5 border border-zinc-200 bg-white p-6 text-zinc-700 shadow-xl duration-200 sm:max-w-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        '-mx-6 -mt-6 flex flex-col gap-2 border-b border-zinc-200 px-6 py-5 text-left dark:border-zinc-800',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        '-mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 sm:flex-row sm:justify-end dark:border-zinc-800 dark:bg-zinc-900/40',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400', className)}
      {...props}
    />
  );
}

const VARIANTS = {
  primary:
    'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
  secondary:
    'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600',
  outline:
    'border-zinc-300 bg-transparent text-zinc-900 hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-300',
  danger:
    'border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-600',
  'outline-danger':
    'border-red-300 bg-transparent text-red-600 hover:border-red-600 dark:border-red-900 dark:text-red-400 dark:hover:border-red-500',
  'light-danger':
    'border-red-200 bg-red-50 text-red-700 hover:border-red-400 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:border-red-700',
} as const;

const buttonVariants = ({
  variant = 'primary',
  className = '',
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
} = {}) =>
  cn(
    'inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors sm:w-auto',
    VARIANTS[variant],
    'disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500',
    className,
  );

function AlertDialogAction({
  className,
  variant = 'primary',
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'outline-danger' | 'light-danger';
}) {
  return <AlertDialogPrimitive.Action className={cn(buttonVariants({ variant }), className)} {...props} />;
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />;
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
