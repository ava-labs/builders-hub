import React, { useEffect, useRef } from "react";

export function OverlaySpinner({
  open,
  message = "Saving Changes...",
}: {
  open: boolean;
  message?: string;
}) {
  const prevActive = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement as HTMLElement | null;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // Move focus to overlay to prevent accidental keyboard interaction
    containerRef.current?.focus();
    return () => {
      prevActive.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      style={{ WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
      role="status"
      aria-live="assertive"
      aria-hidden={!open}
    >
      <div className="flex flex-col items-center gap-3 p-4 bg-fd-background/80 dark:bg-zinc-900 rounded-lg shadow-lg">
       <div className="flex justify-center items-center py-2">
              <svg
                className="animate-spin h-7 w-7 text-red-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
            </div>
        <span className="text-md text-zinc-900 dark:text-zinc-100">{message}</span>
      </div>
    </div>
  );
}

export default OverlaySpinner;