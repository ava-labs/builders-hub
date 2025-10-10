"use client"

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { X, AlertCircle } from 'lucide-react';

interface CustomErrorToastProps {
    message: string;
    toastId: string | number;
    maxLength?: number;
}

export const CustomErrorToast: React.FC<CustomErrorToastProps> = ({message, toastId, maxLength = 220}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const wasExpandedRef = useRef(false);
    const shouldTruncate = message.length > maxLength;
    const displayMessage = isExpanded || !shouldTruncate
        ? message
        : message.substring(0, maxLength) + '...';

    const handleExpand = () => {
        if (!isExpanded) {
            wasExpandedRef.current = true;
        }
        setIsExpanded(!isExpanded);
    };

    useEffect(() => {
        if (isExpanded && wasExpandedRef.current) {
            toast.custom(
                (t) => (
                    <CustomErrorToast
                        message={message}
                        toastId={t}
                        maxLength={maxLength}
                    />
                ),
                {
                    id: toastId,
                    duration: Infinity,
                }
            );
            wasExpandedRef.current = false;
        }
    }, [isExpanded, message, toastId, maxLength]);

    return (
        <div
          className="pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all bg-red-100 dark:bg-red-850 border-red-200 dark:border-red-800"
          style={{ wordBreak: "break-word", maxWidth: "420px" }}
        >
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-800 dark:text-red-800 mb-1">Error</div>
              <div className="text-sm text-red-700 dark:text-red-700">{displayMessage}</div>
              {shouldTruncate && (
                <button
                  onClick={handleExpand}
                  className="text-xs text-red-600 dark:text-red-600 hover:underline mt-2 font-medium"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => toast.dismiss(toastId)}
            className="absolute right-2 top-2 rounded-md p-1 text-red-700 dark:text-red-700 opacity-70 transition-all hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400 border border-transparent hover:bg-red-300/40 hover:border-red-700 dark:hover:bg-red-300/40 dark:hover:border-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      );
};

export const showCustomErrorToast = (message: string, maxLength: number = 220) => {
    const toastId = toast.custom(
        (t) => (
            <CustomErrorToast
                message={message}
                toastId={t}
                maxLength={maxLength}
            />
        ),
        {
            duration: 4000,
        }
    );

    return toastId;
};
