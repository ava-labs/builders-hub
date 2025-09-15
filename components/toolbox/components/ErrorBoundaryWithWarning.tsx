import { ReactNode, Component, ErrorInfo } from "react";
import { AlertCircle, Send } from "lucide-react";
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

    render() {
        const { hasError, error } = this.state;
        const { children } = this.props;

        if (hasError) {
            return (
                <div className="space-y-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-5 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <AlertCircle className="text-red-500 h-6 w-6 flex-shrink-0" />
                            <div className="flex-1 text-lg font-medium text-red-700">
                                Well, that didn't work as expected
                            </div>
                        </div>

                        <div className="mt-3 ml-8 text-sm text-gray-700 space-y-4">
                            <p>
                                It seems we encountered an issue while trying to process your request. Here's the technical details:
                            </p>

                            <div className="text-xs font-mono bg-red-100/50 p-2.5 rounded border border-red-200 overflow-auto max-h-24">
                                {error?.name ?? "Error"}: {error?.message}
                            </div>

                            {error?.message.includes("The error is mostly returned when the client requests") && (
                                <div className="text-sm italic text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-100">
                                    Tip: This usually happens when Core wallet isn't in testnet mode.
                                    Go to Settings → Advanced and enable Testnet mode.
                                </div>
                            )}

                            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button
                                    onClick={() => window.location.reload()}
                                    variant="primary"
                                    size="sm"
                                    className="w-full"
                                >
                                    Try Again
                                </Button>

                                <a href="https://t.me/avalancheacademy" target="_blank" rel="noopener noreferrer" className="w-full">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full"
                                    >
                                        <Send className="h-4 w-4 mr-1.5" />
                                        Get Help in Avalanche Builders Chat
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                            <div className="text-sm text-gray-500 bg-white/80 px-4 py-2 rounded-full shadow-sm">
                                Component disabled due to error
                            </div>
                        </div>
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
