import { toast as sonnerToast } from "sonner";

// Optional 4th-arg options bag. `id` enables deduplication — passing the
// same id twice replaces the previous toast instead of stacking. `action`
// renders an inline button (e.g. "Retry") next to the toast text.
export type ToastOptions = {
  id?: string | number;
  action?: { label: string; onClick: () => void };
};

export const toast = {
  success: (message: string, description?: string, options?: ToastOptions) => {
    return sonnerToast.success(message, { description, ...options });
  },

  error: (message: string, description?: string, options?: ToastOptions) => {
    return sonnerToast.error(message, { description, ...options });
  },

  warning: (message: string, description?: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, { description, ...options });
  },

  info: (message: string, description?: string, options?: ToastOptions) => {
    return sonnerToast.info(message, { description, ...options });
  },

  loading: (message: string, description?: string, options?: ToastOptions) => {
    return sonnerToast.loading(message, { description, ...options });
  },

  message: (message: string, description?: string, options?: ToastOptions) => {
    return sonnerToast(message, { description, ...options });
  },

  action: (message: string, options: { 
    description?: string; 
    action: { 
      label: string; 
      onClick: () => void; 
    }; 
  }) => {
    return sonnerToast(message, {
      description: options.description,
      action: options.action,
    });
  },

  custom: (jsx: React.ReactNode) => {
    return sonnerToast.custom(() => jsx as React.ReactElement);
  },

  promise: <T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
    });
  },

  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
};

export default toast;
