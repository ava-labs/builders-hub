'use client'
import dynamic from 'next/dynamic';

// Import the component lazily with no SSR
const L1Toolbox = dynamic(() => import("@/toolbox/src/demo/ToolboxApp"), {
    ssr: false,
    loading: () => <div>Loading...</div>
});

export default function L1LauncherPage() {
    return (
        <div className="">
            <L1Toolbox />
        </div>
    );
}
