import { ReactNode, Component, ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundaryWithWarning extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Error caught by ErrorBoundaryWithWarning:", error, errorInfo);
    }

    resetError = () => {
        this.setState({
            hasError: false,
            error: null
        });
    };

    render() {
        const { hasError, error } = this.state;
        const { children } = this.props;

        if (hasError) {
            return (
                <div className="space-y-4">
                    <div className="bg-red-100/70 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="text-red-500 h-5 w-5 flex-shrink-0" />
                            <div className="flex-1 text-base font-semibold text-red-700">
                                Oops! Something went wrong. Here's what we know:
                            </div>

                        </div>
                        <div className="mt-2 pl-7 text-sm text-gray-800">
                            <div className="space-y-2 mb-4">
                                {error?.name ?? "Error"}: {error?.message}
                                {error?.message.includes("The error is mostly returned when the client requests") && (
                                    <div className="mt-1 text-xs italic text-gray-600">
                                        This usually indicates that the core wallet is not in testnet mode. Open settings &gt; Advanced &gt; Testnet mode.
                                    </div>
                                )}
                            </div>
                            <Button onClick={() => window.location.reload()} variant="secondary" className="w-90" size="sm">
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Show the component but with a transparent overlay */}
                    <div className="relative">
                        <div className="absolute inset-0 z-10 pointer-events-none"></div>
                        <div className="opacity-50 pointer-events-none">
                            {children}
                        </div>
                    </div>
                </div>
            );
        }

        return children;
    }
} 
