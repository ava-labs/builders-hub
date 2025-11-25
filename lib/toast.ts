import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (message: string, description?: string) => {
    return sonnerToast.success(message, { description });
  },

  error: (message: string, description?: string) => {
    return sonnerToast.error(message, { description });
  },

  warning: (message: string, description?: string) => {
    return sonnerToast.warning(message, { description });
  },

  info: (message: string, description?: string) => {
    return sonnerToast.info(message, { description });
  },

  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, { description });
  },

  message: (message: string, description?: string) => {
    return sonnerToast(message, { description });
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
