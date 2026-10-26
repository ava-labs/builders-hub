'use client';

import { useEffect, useId, useSyncExternalStore } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { CheckCircle2 } from 'lucide-react';

/*
 * Every Toaster renders the whole use-toast store, so two mounted at once (a host page and the Members form inside
 * it) showed each toast twice. Only the first Toaster mounted renders the toasts; when it unmounts, the next one
 * takes over. The server and the first client render know of no mounted Toaster, so both render nothing (no
 * hydration mismatch), and the viewport appears once the first Toaster has mounted.
 */

/** A Toaster that mounts or unmounts, by its id. */
export type ToasterChange = { mount: string } | { unmount: string };

/**
 * The mounted Toasters after `change`, in mount order: the first one renders the toasts. Returns the same list when
 * nothing changes (a second mount of one Toaster under Strict Mode, an unknown unmount), else a new one.
 */
export function toasterOrder(order: readonly string[], change: ToasterChange): readonly string[] {
  if ('mount' in change) return order.includes(change.mount) ? order : [...order, change.mount];
  return order.includes(change.unmount) ? order.filter((id) => id !== change.unmount) : order;
}

let mounted: readonly string[] = [];
const listeners = new Set<() => void>();

function changeMounted(change: ToasterChange) {
  const next = toasterOrder(mounted, change);
  if (next === mounted) return;
  mounted = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function Toaster() {
  const toasterId = useId();
  const renders = useSyncExternalStore(
    subscribe,
    () => mounted[0] === toasterId,
    () => false,
  );
  const { toasts } = useToast();

  useEffect(() => {
    changeMounted({ mount: toasterId });
    return () => changeMounted({ unmount: toasterId });
  }, [toasterId]);

  if (!renders) return null;

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className='flex items-start gap-3'>
              {variant === 'success' && (
                <CheckCircle2 className='h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5' />
              )}
              <div className='grid gap-1'>
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
