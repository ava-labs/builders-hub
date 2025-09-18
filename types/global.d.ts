interface Window {
    ethereum?: {
        request: (args: { method: string; params?: any[] }) => Promise<any>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
        selectedAddress?: string;
        chainId?: string;
        isMetaMask?: boolean;
        isConnected?: () => boolean;
    };
}

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on: (event: string, callback: (...args: any[]) => void) => void;
            removeListener: (event: string, callback: (...args: any[]) => void) => void;
            selectedAddress?: string;
            chainId?: string;
            isMetaMask?: boolean;
            isConnected?: () => boolean;
        };
        avalanche?: {
            request: <T>(args: {
                method: string;
                params?: Record<string, unknown> | unknown[];
                id?: number;
            }) => Promise<T>;
            on<T>(event: string, callback: (data: T) => void): void;
            removeListener(event: string, callback: () => void): void;
        };
    }
}

export { }; 
