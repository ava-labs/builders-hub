import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'warning' | 'info' | 'success';
  className?: string;
  icon?: boolean;
}

export const Alert = ({ children, variant = 'info', className, icon = true }: AlertProps) => {
  const variantConfig = {
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
      icon: <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />,
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
      icon: <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />,
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
      icon: <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />,
    },
    success: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
      icon: <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />,
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        "p-3 rounded-md border text-sm",
        config.container,
        className
      )}
    >
      <div className="flex gap-3 items-center">
        {icon && config.icon}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
};
