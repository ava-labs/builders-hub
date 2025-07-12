'use client'
import dynamic from 'next/dynamic';

// Import the component lazily with no SSR
const L1Toolbox = dynamic(() => import("@/toolbox/src/toolbox/ToolboxApp"), {
    ssr: false,
    loading: () => <div className="flex justify-center items-center min-h-screen p-4 opacity-50">Loading...</div>
});

export default function L1ToolboxPage() {
    return (
        <div className="">
            <L1Toolbox />
        </div>
    );
}
