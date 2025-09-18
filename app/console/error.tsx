'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Primary Network Error:', error)
    }, [error])

    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
            <div className="mx-auto max-w-md text-center">
                <div className="mb-4 flex justify-center">
                    <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                        <svg
                            className="h-6 w-6 text-red-600 dark:text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>
                <h2 className="mb-2 text-2xl font-bold">Oops! Something went wrong</h2>
                <p className="mb-4 text-muted-foreground">
                    {error.message || 'Something went wrong with this transaction'}
                </p>
                {error.digest && (<div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-3 mb-4">
                    <p className="text-sm text-red-800 dark:text-red-300 font-mono break-all">
                        {`Error ID: ${error.digest}`}
                    </p>
                </div>)}
                <p className="text-sm text-muted-foreground mb-6">
                    See details in your browser console. Please reload the page.
                </p>
                <Button
                    onClick={() => reset()}
                    className="w-full"
                >
                    Reload page
                </Button>
            </div>
        </div>
    )
}
