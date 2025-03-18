'use client'
import dynamic from 'next/dynamic';
import { default as L1Toolbox } from "@/toolbox/src/demo/ToolboxApp"

export default function L1LauncherPage() {
    const NoSSRL1Toolbox = dynamic(() => Promise.resolve(L1Toolbox), { ssr: false });

    return (
        <div className="">
            <NoSSRL1Toolbox />
        </div>
    );
}
