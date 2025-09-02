import { CheckCircle, Loader2, XCircle } from "lucide-react"

export interface StepStatus {
  status: "pending" | "loading" | "success" | "error"
  error?: string
}

export interface StepIndicatorProps<T extends string> {
  status: StepStatus["status"]
  label: string
  error?: string
  onRetry?: (step: T) => void
  stepKey: T
}

export function StepIndicator<T extends string>({
  status,
  label,
  error,
  onRetry,
  stepKey,
}: StepIndicatorProps<T>) {
  return (
    <div 
      className={`flex flex-col space-y-1 my-2 ${onRetry ? 'cursor-pointer' : ''}`}
      onClick={() => onRetry && onRetry(stepKey)}
    >
      <div className="flex items-center space-x-2">
        {status === "loading" && (
          <div className="h-5 w-5 flex-shrink-0">
            <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          </div>
        )}
        {status === "success" && (
          <div className="h-5 w-5 flex-shrink-0">
            <CheckCircle className="h-5 w-5 text-green-500 fill-green-100" />
          </div>
        )}
        {status === "error" && (
          <div className="h-5 w-5 flex-shrink-0">
            <XCircle className="h-5 w-5 text-red-500 fill-red-100" />
          </div>
        )}
        {status === "pending" && <div className="h-5 w-5 rounded-full border-2 border-zinc-200 flex-shrink-0" />}

        <span
          className={`text-sm ${status === "error" ? "text-red-600 font-medium" : "text-zinc-700 dark:text-zinc-300"}`}
        >
          {label}
        </span>
      </div>

      {status === "error" && error && (
        <div className="ml-7 p-2 bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500 rounded text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  )
} 