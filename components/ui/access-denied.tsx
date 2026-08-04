import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AccessDeniedProps {
  message?: string;
}

export function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <main className="container relative max-w-[1400px] pt-4 pb-16">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong className="font-semibold">Access Denied</strong>
            <p className="mt-2">
              {message ?? "You don't have permission to view this section."}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </main>
  );
}
