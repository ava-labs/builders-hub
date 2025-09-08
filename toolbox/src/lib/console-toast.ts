/**
 * console-specific toast utility for toolbox components
 * ensures toasts work properly when toolbox components are used in console
 */

import { toast } from "@/lib/toast";

export const consoleToast = {
  success: (message: string) => {
    return toast.success(message);
  },

  error: (message: string) => {
    return toast.error(message);
  },

  warning: (message: string) => {
    return toast.warning(message);
  },

  info: (message: string) => {
    return toast.info(message);
  },

  loading: (message: string) => {
    return toast.loading(message);
  },

  dismiss: (toastId?: string | number) => {
    return toast.dismiss(toastId);
  },
};
